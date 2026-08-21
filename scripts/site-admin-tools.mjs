import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { listCompetitionPacks } from "./competition-installer-tools.mjs";
import { applySiteCreationPlan, buildSiteCreationPlan, readSiteBlueprint } from "./site-creator-tools.mjs";
import { validateCreatedSite } from "./site-validation-tools.mjs";
import { resolveInside, writeJson } from "./template-tools.mjs";

const MAX_BODY_BYTES = 5 * 1024 * 1024;
const STATIC_FILES = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
]);
const IMAGE_TYPES = new Map([
  [".png", "image/png"], [".jpg", "image/jpeg"], [".jpeg", "image/jpeg"],
  [".webp", "image/webp"], [".gif", "image/gif"], [".avif", "image/avif"], [".ico", "image/x-icon"],
]);

function listPublicImages(root) {
  const publicRoot = path.join(root, "public");
  const images = [];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) walk(absolutePath);
      else if (entry.isFile() && IMAGE_TYPES.has(path.extname(entry.name).toLowerCase())) {
        const relative = path.relative(publicRoot, absolutePath).replaceAll("\\", "/");
        images.push({ path: `/${relative}`, name: entry.name, bytes: fs.statSync(absolutePath).size });
      }
    }
  };
  walk(publicRoot);
  return images.sort((left, right) => left.path.localeCompare(right.path));
}

function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function blueprintPath(root) {
  return path.join(root, "site", "blueprint.json");
}

function currentRevision(root) {
  return hash(fs.readFileSync(blueprintPath(root)));
}

function responseJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(body);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error("Request body is too large."), { statusCode: 413 }));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        reject(Object.assign(new Error("Request body must be valid JSON."), { statusCode: 400 }));
      }
    });
    request.on("error", reject);
  });
}

function planSummary(root, plan) {
  const checklist = JSON.parse(
    plan.writes.get(path.join(root, "site", "generated", "resource-checklist.json")),
  );
  const missingResources = checklist.resources.filter((resource) => resource.status === "missing");
  const canonicalBlueprint = plan.writes.get(blueprintPath(root));
  return {
    status: plan.status,
    siteId: plan.blueprint.site.id,
    siteName: plan.blueprint.site.name,
    games: plan.blueprint.games.length,
    filters: plan.blueprint.filters.groups.length,
    changes: plan.changes,
    additions: plan.additions,
    updates: plan.updates,
    missingResources,
    previewDigest: hash(canonicalBlueprint),
  };
}

function authorized(request, token) {
  const supplied = request.headers["x-site-admin-token"];
  if (typeof supplied !== "string") return false;
  const left = Buffer.from(supplied);
  const right = Buffer.from(token);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function safeHost(request) {
  const hostname = String(request.headers.host || "").split(":")[0].replace(/^\[|\]$/g, "");
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
}

function safeOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return true;
  try {
    const hostname = new URL(origin).hostname;
    return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
  } catch {
    return false;
  }
}

export function createSiteAdminServer({ root, token, validate = validateCreatedSite }) {
  if (!token || token.length < 24) throw new Error("The local admin token must contain at least 24 characters.");
  const assetRoot = path.join(root, "admin");
  let applying = false;
  return http.createServer(async (request, response) => {
    try {
      if (!safeHost(request)) return responseJson(response, 403, { ok: false, error: "Untrusted host." });
      const url = new URL(request.url || "/", `http://${request.headers.host}`);
      if (url.pathname.startsWith("/api/")) {
        if (!authorized(request, token)) return responseJson(response, 401, { ok: false, error: "Local admin token is missing or invalid." });
        if (!safeOrigin(request)) return responseJson(response, 403, { ok: false, error: "Cross-origin requests are not allowed." });
      }

      if (request.method === "GET" && url.pathname === "/api/blueprint") {
        const blueprint = readSiteBlueprint(blueprintPath(root));
        return responseJson(response, 200, {
          ok: true,
          blueprint,
          revision: currentRevision(root),
          packageVersion: JSON.parse(fs.readFileSync(path.join(root, "template", "template.json"), "utf8")).version,
          competitionAdapters: listCompetitionPacks(root).map((pack) => ({ id: pack.id, displayName: pack.displayName })),
        });
      }

      if (request.method === "GET" && url.pathname === "/api/resources") {
        return responseJson(response, 200, { ok: true, images: listPublicImages(root) });
      }

      if (request.method === "POST" && url.pathname === "/api/preview") {
        const body = await readBody(request);
        const plan = buildSiteCreationPlan({ root, blueprint: body.blueprint });
        return responseJson(response, 200, {
          ok: true,
          ...planSummary(root, plan),
          diskChanged: typeof body.baseRevision === "string" && body.baseRevision !== currentRevision(root),
        });
      }

      if (request.method === "POST" && url.pathname === "/api/apply") {
        if (applying) return responseJson(response, 409, { ok: false, error: "Another save is already running." });
        const body = await readBody(request);
        if (typeof body.baseRevision !== "string" || body.baseRevision !== currentRevision(root)) {
          return responseJson(response, 409, { ok: false, error: "The blueprint changed on disk. Reload before saving." });
        }
        const plan = buildSiteCreationPlan({ root, blueprint: body.blueprint });
        const summary = planSummary(root, plan);
        if (body.confirm !== summary.siteId) {
          return responseJson(response, 400, { ok: false, error: `Confirmation must match site ID: ${summary.siteId}.` });
        }
        if (body.previewDigest !== summary.previewDigest) {
          return responseJson(response, 409, { ok: false, error: "Preview is stale. Preview these changes again before saving." });
        }
        if (summary.missingResources.length) {
          return responseJson(response, 400, { ok: false, error: "Add every missing local resource before saving.", ...summary });
        }
        if (plan.status === "current") {
          return responseJson(response, 200, { ok: true, ...summary, revision: currentRevision(root), validation: [] });
        }
        applying = true;
        try {
          const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
          const backupRoot = path.join(root, "backups", "site-admin", timestamp);
          writeJson(path.join(backupRoot, "admin-plan.json"), {
            schemaVersion: 1,
            createdAt: new Date().toISOString(),
            baseRevision: body.baseRevision,
            siteId: summary.siteId,
            updates: plan.updates,
            additions: plan.additions,
          });
          let validation = [];
          applySiteCreationPlan({
            root,
            plan,
            backupRoot,
            validate: () => { validation = validate(root); },
          });
          return responseJson(response, 200, {
            ok: true,
            ...summary,
            revision: currentRevision(root),
            backup: path.relative(root, backupRoot).replaceAll("\\", "/"),
            validation,
          });
        } finally {
          applying = false;
        }
      }

      const asset = STATIC_FILES.get(url.pathname);
      if (request.method === "GET" && asset) {
        const [fileName, contentType] = asset;
        const contents = fs.readFileSync(path.join(assetRoot, fileName));
        response.writeHead(200, {
          "Content-Type": contentType,
          "Content-Length": contents.length,
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
        });
        return response.end(contents);
      }
      if (request.method === "GET" && url.pathname.startsWith("/preview/public/")) {
        const encoded = url.pathname.slice("/preview/public/".length);
        const relative = encoded.split("/").map((segment) => decodeURIComponent(segment)).join("/");
        const extension = path.extname(relative).toLowerCase();
        if (!relative || !IMAGE_TYPES.has(extension)) return responseJson(response, 404, { ok: false, error: "Image not found." });
        const filePath = resolveInside(path.join(root, "public"), relative);
        if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return responseJson(response, 404, { ok: false, error: "Image not found." });
        const contents = fs.readFileSync(filePath);
        response.writeHead(200, { "Content-Type": IMAGE_TYPES.get(extension), "Content-Length": contents.length, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
        return response.end(contents);
      }
      responseJson(response, 404, { ok: false, error: "Not found." });
    } catch (error) {
      const status = Number(error?.statusCode) || 400;
      responseJson(response, status >= 400 && status < 600 ? status : 500, {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}
