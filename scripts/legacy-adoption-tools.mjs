import fs from "node:fs";
import path from "node:path";
import { hashFile } from "./template-tools.mjs";

function walkFiles(root, directory = root, files = []) {
  if (!fs.existsSync(directory)) return files;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`Symbolic links are not supported during adoption: ${absolutePath}`);
    }
    if (entry.isDirectory()) walkFiles(root, absolutePath, files);
    else if (entry.isFile()) files.push(path.relative(root, absolutePath).replaceAll("\\", "/"));
  }
  return files.sort();
}

export function inferLegacyDomain(targetRoot) {
  const candidates = [
    path.join(targetRoot, "next-sitemap.config.js"),
    path.join(targetRoot, "next-sitemap.config.mjs"),
    path.join(targetRoot, "app", "layout.tsx"),
    path.join(targetRoot, "app", "layout.jsx"),
  ];
  const hosts = [];
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) continue;
    const source = fs.readFileSync(candidate, "utf8");
    for (const match of source.matchAll(/https:\/\/([a-z0-9.-]+)(?:[/:"'`]|$)/gi)) {
      const host = match[1].toLowerCase().replace(/^www\./, "");
      if (!hosts.includes(host)) hosts.push(host);
    }
  }
  return hosts.find((host) => !host.startsWith("mt.")) || hosts[0] || null;
}

export function discoverLegacyRoutes(targetRoot) {
  const appRoot = path.join(targetRoot, "app");
  if (!fs.existsSync(appRoot)) return [];
  return walkFiles(appRoot)
    .filter((relativePath) => /(^|\/)page\.(?:tsx|ts|jsx|js)$/.test(relativePath))
    .map((relativePath) => {
      const route = relativePath.replace(/(^|\/)page\.(?:tsx|ts|jsx|js)$/, "");
      return route ? `/${route}` : "/";
    })
    .sort();
}

export function compareFileTrees(sourceRoot, targetRoot) {
  const sourceFiles = walkFiles(sourceRoot);
  const missing = [];
  const different = [];
  const identical = [];
  for (const relativePath of sourceFiles) {
    const sourcePath = path.join(sourceRoot, relativePath);
    const targetPath = path.join(targetRoot, relativePath);
    if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isFile()) {
      missing.push(relativePath);
    } else if (hashFile(sourcePath) === hashFile(targetPath)) {
      identical.push(relativePath);
    } else {
      different.push(relativePath);
    }
  }
  return { missing, different, identical };
}

export function buildLegacyAdoptionAudit({ targetRoot, sitePackageRoot, templateRoot }) {
  const required = ["package.json", "app"];
  const missingRequired = required.filter(
    (relativePath) => !fs.existsSync(path.join(targetRoot, relativePath)),
  );
  if (missingRequired.length) {
    throw new Error(`Legacy target is missing ${missingRequired.join(", ")}.`);
  }
  const siteManifestPath = path.join(sitePackageRoot, "manifest.json");
  if (!fs.existsSync(siteManifestPath)) {
    throw new Error(`Site package is missing manifest.json: ${sitePackageRoot}`);
  }
  const manifest = JSON.parse(fs.readFileSync(siteManifestPath, "utf8"));
  const inferredDomain = inferLegacyDomain(targetRoot);
  const packageDomain = String(manifest.site?.domain || "").toLowerCase().replace(/^www\./, "");
  const existingSiteManifest = fs.existsSync(path.join(targetRoot, "site", "manifest.json"));
  const partialSitePackage =
    fs.existsSync(path.join(targetRoot, "site")) && !existingSiteManifest;
  const releaseBaselineExists = fs.existsSync(
    path.join(targetRoot, "template", "release-manifest.json"),
  );
  const domainMatches = Boolean(
    inferredDomain && packageDomain && inferredDomain === packageDomain,
  );
  const functionsComparison = compareFileTrees(
    path.join(templateRoot, "functions"),
    path.join(targetRoot, "functions"),
  );
  const routes = discoverLegacyRoutes(targetRoot);
  const legacyConfigurationFiles = [
    "config/games.ts",
    "config/game-tags.ts",
    "config/popular-games.ts",
    "config/shooting-games.ts",
  ].filter((relativePath) => fs.existsSync(path.join(targetRoot, relativePath)));
  const blockers = [];
  if (existingSiteManifest) blockers.push("Target already has site/manifest.json.");
  if (partialSitePackage) blockers.push("Target contains a partial site directory.");
  if (releaseBaselineExists) blockers.push("Target already has a template release baseline.");
  if (!inferredDomain) blockers.push("Legacy domain could not be inferred.");
  if (inferredDomain && packageDomain && !domainMatches) {
    blockers.push(`Site package domain ${packageDomain} does not match legacy domain ${inferredDomain}.`);
  }

  return {
    status: blockers.length ? "blocked" : "ready",
    targetRoot,
    sitePackageRoot,
    inferredDomain,
    packageDomain,
    domainMatches,
    routes,
    routeCount: routes.length,
    legacyConfigurationFiles,
    sitePackageFileCount: walkFiles(sitePackageRoot).length,
    functionsComparison,
    protectedAreas: ["public", "functions", "migrations", ".env*"],
    manualFollowUp: functionsComparison.different.length || functionsComparison.missing.length
      ? [
          "Protected Pages Functions differ from the template wrappers and require a separate reviewed migration.",
          "Existing D1 migrations and public assets remain untouched.",
        ]
      : ["Existing D1 migrations and public assets remain untouched."],
    blockers,
  };
}

export function copySitePackage(sourceRoot, targetRoot) {
  const files = walkFiles(sourceRoot);
  for (const relativePath of files) {
    const sourcePath = path.join(sourceRoot, relativePath);
    const targetPath = path.join(targetRoot, relativePath);
    if (fs.existsSync(targetPath)) {
      throw new Error(`Adoption refuses to overwrite existing site file: ${relativePath}`);
    }
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
  }
  return files;
}
