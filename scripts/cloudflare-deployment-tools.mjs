import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { resolveInside } from "./template-tools.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BINDING = /^[A-Za-z_][A-Za-z0-9_]*$/;
const D1_LOCATIONS = new Set(["weur", "eeur", "apac", "oc", "wnam", "enam"]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function required(value, label, maximum = 200) {
  const normalized = String(value || "").trim();
  if (!normalized || normalized.length > maximum) {
    throw new Error(`${label} must contain 1-${maximum} characters.`);
  }
  return normalized;
}

function hashFile(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function selectedAdapter(root) {
  return fs.readFileSync(path.join(root, "site", "backend.ts"), "utf8")
    .match(/competitionAdapterId:\s*["']([^"']+)["']/)?.[1];
}

function selectedBinding(root) {
  return fs.readFileSync(path.join(root, "site", "backend.ts"), "utf8")
    .match(/databaseBinding:\s*["']([^"']+)["']/)?.[1];
}

export function normalizeCloudflareConfig(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("site/cloudflare.json must contain an object.");
  }
  if (value.schemaVersion !== 1) throw new Error("site/cloudflare.json must use schemaVersion 1.");
  const database = value.database || {};
  const binding = required(database.binding, "database.binding", 64);
  if (!BINDING.test(binding)) throw new Error("database.binding must be a valid binding identifier.");
  const productionUrl = new URL(required(value.productionUrl, "productionUrl", 300));
  if (productionUrl.protocol !== "https:") throw new Error("productionUrl must use HTTPS.");
  if (database.migrationStrategy !== undefined) {
    throw new Error("database.migrationStrategy is no longer supported. Every generated site must use a fresh D1 database managed by Wrangler.");
  }
  const location = String(database.location || "").trim();
  if (location && !D1_LOCATIONS.has(location)) {
    throw new Error("database.location must be empty, weur, eeur, apac, oc, wnam, or enam.");
  }
  const checks = value.health?.checks;
  if (!Array.isArray(checks) || checks.length === 0) {
    throw new Error("health.checks must be a non-empty array.");
  }
  return {
    schemaVersion: 1,
    accountId: String(value.accountId || "").trim(),
    pagesProject: required(value.pagesProject, "pagesProject", 120),
    productionUrl: productionUrl.origin,
    productionBranch: required(value.productionBranch || "main", "productionBranch", 120),
    database: {
      binding,
      name: required(database.name, "database.name", 120),
      id: String(database.id || "").trim(),
      previewId: String(database.previewId || "").trim(),
      location,
    },
    health: {
      timeoutMs: Math.max(1000, Math.min(30000, Number(value.health?.timeoutMs || 10000))),
      checks: checks.map((check, index) => ({
        name: required(check?.name, `health.checks[${index}].name`, 80),
        path: required(check?.path, `health.checks[${index}].path`, 300),
        expect: check?.expect === "html" ? "html" : "ok",
      })),
    },
  };
}

export function buildMigrationPlan(root) {
  const adapter = selectedAdapter(root);
  const manifestPath = fs.existsSync(path.join(root, "site", "competition-migrations.json"))
    ? path.join(root, "site", "competition-migrations.json")
    : path.join(root, "backend", "migrations.json");
  const manifest = readJson(manifestPath);
  if (!adapter || !Array.isArray(manifest.groups?.[adapter])) {
    throw new Error(`No migration group exists for selected adapter ${adapter || "unknown"}.`);
  }
  const relativePaths = [...new Set([
    ...(manifest.groups.community || []),
    ...manifest.groups[adapter],
  ])].sort((left, right) =>
    Number(path.basename(left).match(/^(\d+)_/)?.[1]) -
    Number(path.basename(right).match(/^(\d+)_/)?.[1]),
  );
  const migrations = relativePaths.map((relativePath) => {
    const absolutePath = resolveInside(root, relativePath);
    if (!fs.existsSync(absolutePath)) throw new Error(`Migration is missing: ${relativePath}`);
    return {
      name: path.basename(relativePath),
      relativePath: relativePath.replaceAll("\\", "/"),
      absolutePath,
      sha256: hashFile(absolutePath),
    };
  });
  return { adapter, manifestPath, migrations };
}

export function buildCloudflareAudit(root) {
  const configPath = path.join(root, "site", "cloudflare.json");
  if (!fs.existsSync(configPath)) throw new Error("site/cloudflare.json is missing.");
  const config = normalizeCloudflareConfig(readJson(configPath));
  const manifest = readJson(path.join(root, "site", "manifest.json"));
  const migrationPlan = buildMigrationPlan(root);
  const blockers = [];
  const warnings = [];
  if (config.productionUrl !== manifest.site.url) {
    blockers.push(`productionUrl must match site.manifest URL (${manifest.site.url}).`);
  }
  const backendBinding = selectedBinding(root);
  if (config.database.binding !== backendBinding) {
    blockers.push(`D1 binding mismatch: cloudflare=${config.database.binding}, site/backend.ts=${backendBinding}.`);
  }
  if (!config.database.id) warnings.push("database.id is empty; run cloudflare:provision before migrations or deployment.");
  else if (!UUID.test(config.database.id)) blockers.push("database.id must be a Cloudflare UUID.");
  if (config.database.previewId && !UUID.test(config.database.previewId)) {
    blockers.push("database.previewId must be empty or a Cloudflare UUID.");
  }
  if (config.accountId && !/^[0-9a-f]{32}$/i.test(config.accountId)) {
    blockers.push("accountId must be empty or a 32-character Cloudflare account ID.");
  }
  const artifacts = {
    html: fs.existsSync(path.join(root, "out", "index.html")),
    worker: fs.existsSync(path.join(root, "out", "_worker.js")),
    routes: fs.existsSync(path.join(root, "out", "_routes.json")),
  };
  if (!Object.values(artifacts).every(Boolean)) {
    warnings.push("Production artifacts are incomplete; run npm run build before deployment.");
  } else {
    const routes = readJson(path.join(root, "out", "_routes.json"));
    if (!(routes.include || []).includes("/api/health")) {
      warnings.push("out/_routes.json predates the health endpoint; rebuild before deployment.");
    }
  }
  return {
    status: blockers.length ? "blocked" : warnings.length ? "attention" : "ready",
    config,
    configPath,
    manifest,
    migrationPlan,
    artifacts,
    blockers,
    warnings,
    confirmations: {
      migrations: `${manifest.site.id}/${config.database.name}`,
      deploy: `${manifest.site.id}/${config.pagesProject}`,
      provision: `${manifest.site.id}/${config.database.name}/create`,
    },
  };
}

export function prepareCloudflareWorkspace(root, audit, { local = false } = {}) {
  if (audit.blockers.length) throw new Error("Cloudflare workspace cannot be prepared while audit blockers exist.");
  if (!audit.config.database.id && !local) throw new Error("database.id is required before preparing remote migrations.");
  const databaseId = audit.config.database.id || "00000000-0000-4000-8000-000000000000";
  const fingerprint = crypto.createHash("sha256").update(JSON.stringify({
    config: audit.config,
    migrations: audit.migrationPlan.migrations.map((item) => [item.name, item.sha256]),
  })).digest("hex").slice(0, 12);
  const workspace = path.join(root, ".wrangler", "cloudflare-deploy", fingerprint);
  const migrationsDirectory = path.join(workspace, "migrations");
  fs.mkdirSync(migrationsDirectory, { recursive: true });
  audit.migrationPlan.migrations.forEach((migration) => {
    fs.copyFileSync(migration.absolutePath, path.join(migrationsDirectory, migration.name));
  });
  const wranglerConfig = {
    $schema: "../../../node_modules/wrangler/config-schema.json",
    name: audit.config.pagesProject,
    ...(audit.config.accountId ? { account_id: audit.config.accountId } : {}),
    pages_build_output_dir: "../../../out",
    d1_databases: [{
      binding: audit.config.database.binding,
      database_name: audit.config.database.name,
      database_id: databaseId,
      ...(audit.config.database.previewId
        ? { preview_database_id: audit.config.database.previewId }
        : {}),
      migrations_dir: "migrations",
    }],
  };
  const wranglerPath = path.join(workspace, "wrangler.jsonc");
  fs.writeFileSync(wranglerPath, `${JSON.stringify(wranglerConfig, null, 2)}\n`);
  const planPath = path.join(workspace, "deployment-plan.json");
  fs.writeFileSync(planPath, `${JSON.stringify({
    schemaVersion: 1,
    siteId: audit.manifest.site.id,
    pagesProject: audit.config.pagesProject,
    database: {
      binding: audit.config.database.binding,
      name: audit.config.database.name,
      id: databaseId,
    },
    adapter: audit.migrationPlan.adapter,
    migrations: audit.migrationPlan.migrations.map(({ name, relativePath, sha256 }) => ({ name, relativePath, sha256 })),
  }, null, 2)}\n`);
  return { workspace, migrationsDirectory, wranglerPath, planPath };
}

export function prepareCloudflareProvisionWorkspace(root, audit) {
  if (audit.blockers.length) throw new Error("Cloudflare provisioning cannot start while audit blockers exist.");
  if (audit.config.database.id) throw new Error("database.id is already configured; refusing to create a second D1 database.");
  const fingerprint = crypto.createHash("sha256").update(JSON.stringify({
    siteId: audit.manifest.site.id,
    pagesProject: audit.config.pagesProject,
    database: {
      binding: audit.config.database.binding,
      name: audit.config.database.name,
      location: audit.config.database.location,
    },
  })).digest("hex").slice(0, 12);
  const workspace = path.join(root, ".wrangler", "cloudflare-provision", fingerprint);
  fs.mkdirSync(workspace, { recursive: true });
  const wranglerPath = path.join(workspace, "wrangler.jsonc");
  fs.writeFileSync(wranglerPath, `${JSON.stringify({
    $schema: "../../../node_modules/wrangler/config-schema.json",
    name: audit.config.pagesProject,
    ...(audit.config.accountId ? { account_id: audit.config.accountId } : {}),
    pages_build_output_dir: "../../../out",
  }, null, 2)}\n`);
  return { workspace, wranglerPath };
}

export function readProvisionedDatabaseId(wranglerPath, expected) {
  const config = readJson(wranglerPath);
  const bindings = Array.isArray(config.d1_databases) ? config.d1_databases : [];
  const matching = bindings.find((entry) =>
    entry?.binding === expected.binding && entry?.database_name === expected.name,
  );
  if (!matching || !UUID.test(String(matching.database_id || ""))) {
    throw new Error("Wrangler created the database but did not write the expected binding and UUID to its temporary config.");
  }
  return matching.database_id;
}

export function persistProvisionedDatabaseId(root, audit, databaseId, { now = new Date() } = {}) {
  if (!UUID.test(String(databaseId || ""))) throw new Error("Refusing to persist an invalid D1 database UUID.");
  if (audit.config.database.id) throw new Error("database.id is already configured; refusing to overwrite it.");
  const configPath = audit.configPath;
  const config = readJson(configPath);
  const timestamp = now.toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(root, "backups", "cloudflare-provision", timestamp, "site", "cloudflare.json");
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  fs.copyFileSync(configPath, backupPath);
  config.database = { ...config.database, id: databaseId };
  const temporaryPath = `${configPath}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, `${JSON.stringify(config, null, 2)}\n`);
    fs.renameSync(temporaryPath, configPath);
  } finally {
    if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
  }
  return { configPath, backupPath };
}

export function buildPagesDeployArguments(audit, workspace) {
  if (!audit.config.database.id) throw new Error("D1 must be configured before building a Pages deployment command.");
  return [
    "pages", "deploy",
    "--project-name", audit.config.pagesProject,
    "--branch", audit.config.productionBranch,
    "--cwd", workspace,
  ];
}

export async function runHealthChecks({ config, primaryGameId, baseUrl, fetchImpl = fetch }) {
  const origin = new URL(baseUrl || config.productionUrl).origin;
  const results = [];
  for (const check of config.health.checks) {
    const checkPath = check.path.replaceAll("{primaryGameId}", encodeURIComponent(primaryGameId));
    const url = new URL(checkPath, origin).toString();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.health.timeoutMs);
    try {
      const response = await fetchImpl(url, {
        signal: controller.signal,
        headers: { Accept: check.expect === "html" ? "text/html" : "application/json" },
      });
      const body = check.expect === "html" ? await response.text() : await response.json();
      const passed = response.ok && (
        check.expect === "html" ? String(body).length > 0 : body?.ok === true
      );
      results.push({ name: check.name, url, status: response.status, passed, detail: passed ? "ok" : "unexpected response" });
    } catch (error) {
      results.push({ name: check.name, url, status: 0, passed: false, detail: error instanceof Error ? error.message : String(error) });
    } finally {
      clearTimeout(timeout);
    }
  }
  return { ok: results.every((item) => item.passed), origin, results };
}
