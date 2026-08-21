import fs from "node:fs";
import path from "node:path";
import { hashFile } from "./template-tools.mjs";

export function listFunctionFiles(root) {
  const files = [];
  function walk(directory) {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`Symbolic links are not supported in Pages Functions: ${absolutePath}`);
      }
      if (entry.isDirectory()) walk(absolutePath);
      else if (entry.isFile()) files.push(path.relative(root, absolutePath).replaceAll("\\", "/"));
    }
  }
  walk(root);
  return files.sort();
}

export function functionRoute(relativePath) {
  if (!relativePath.startsWith("api/") || !relativePath.endsWith(".ts")) return null;
  return `/${relativePath.slice(0, -3).replace(/\/index$/, "")}`;
}

export function buildFunctionsMigrationAudit({ templateRoot, targetRoot }) {
  const sourceRoot = path.join(templateRoot, "functions");
  const targetFunctionsRoot = path.join(targetRoot, "functions");
  if (!fs.existsSync(sourceRoot)) throw new Error("Template source has no functions directory.");
  if (!fs.existsSync(targetFunctionsRoot)) {
    throw new Error("Target has no functions directory to migrate.");
  }

  const prerequisites = [
    "backend/runtime.ts",
    "backend/migrations.json",
    "site/backend.ts",
    "scripts/validate-backend.mjs",
    "template/template.json",
  ];
  const missingPrerequisites = prerequisites.filter(
    (relativePath) => !fs.existsSync(path.join(targetRoot, relativePath)),
  );
  const sourceFiles = listFunctionFiles(sourceRoot);
  const targetFiles = new Set(listFunctionFiles(targetFunctionsRoot));
  const additions = [];
  const updates = [];
  const unchanged = [];
  for (const relativePath of sourceFiles) {
    const sourcePath = path.join(sourceRoot, relativePath);
    const targetPath = path.join(targetFunctionsRoot, relativePath);
    if (!targetFiles.has(relativePath)) additions.push(relativePath);
    else if (hashFile(sourcePath) === hashFile(targetPath)) unchanged.push(relativePath);
    else updates.push(relativePath);
  }
  const extras = [...targetFiles].filter((relativePath) => !sourceFiles.includes(relativePath));
  const routes = sourceFiles.map(functionRoute).filter(Boolean);
  const blockers = missingPrerequisites.map(
    (relativePath) => `Target must complete site adoption and core update before Functions migration: missing ${relativePath}.`,
  );
  return {
    status: blockers.length
      ? "blocked"
      : additions.length || updates.length
        ? "ready"
        : "current",
    targetRoot,
    sourceFileCount: sourceFiles.length,
    routeCount: routes.length,
    routes,
    additions,
    updates,
    unchanged,
    extras,
    missingPrerequisites,
    blockers,
    protected: {
      migrations: "untouched",
      public: "untouched",
      environment: "untouched",
      extraFunctionFiles: "preserved",
    },
  };
}

export function copyFunctionMigration({ templateRoot, targetRoot, additions, updates, backupRoot }) {
  const sourceRoot = path.join(templateRoot, "functions");
  const targetFunctionsRoot = path.join(targetRoot, "functions");
  for (const relativePath of updates) {
    const targetPath = path.join(targetFunctionsRoot, relativePath);
    const backupPath = path.join(backupRoot, "functions", relativePath);
    fs.mkdirSync(path.dirname(backupPath), { recursive: true });
    fs.copyFileSync(targetPath, backupPath);
  }
  for (const relativePath of [...additions, ...updates]) {
    const sourcePath = path.join(sourceRoot, relativePath);
    const targetPath = path.join(targetFunctionsRoot, relativePath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
  }
}

export function rollbackFunctionMigration({ targetRoot, additions, updates, backupRoot }) {
  const targetFunctionsRoot = path.resolve(targetRoot, "functions");
  if (path.dirname(targetFunctionsRoot).toLowerCase() !== path.resolve(targetRoot).toLowerCase()) {
    throw new Error("Refusing to roll back Functions outside the target root.");
  }
  for (const relativePath of additions) {
    const targetPath = path.join(targetFunctionsRoot, relativePath);
    if (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) fs.unlinkSync(targetPath);
  }
  for (const relativePath of updates) {
    const backupPath = path.join(backupRoot, "functions", relativePath);
    const targetPath = path.join(targetFunctionsRoot, relativePath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(backupPath, targetPath);
  }
}
