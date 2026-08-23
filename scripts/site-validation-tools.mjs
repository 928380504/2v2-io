import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { cleanGeneratedCaches } from "./generated-cache-tools.mjs";

function runNode(root, relativePath, logs) {
  const result = spawnSync(process.execPath, [path.join(root, relativePath)], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 30 * 1024 * 1024,
  });
  if (result.stdout) logs.push(result.stdout.trim());
  if (result.stderr) logs.push(result.stderr.trim());
  if (result.status !== 0) throw new Error(`${relativePath} failed.`);
}

function runProjectBinary(root, relativePath, args, label, logs, maxBuffer) {
  const binary = path.join(root, relativePath);
  if (!fs.existsSync(binary)) {
    throw new Error(`${label} is not installed. Run npm install before applying a site blueprint.`);
  }
  const result = spawnSync(process.execPath, [binary, ...args], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer,
  });
  if (result.stdout) logs.push(result.stdout.trim());
  if (result.stderr) logs.push(result.stderr.trim());
  if (result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`${label} failed.${details ? `\n${details.slice(-6000)}` : ""}`);
  }
}

export function validateCreatedSite(root, { writeOutput = false } = {}) {
  const logs = [];
  cleanGeneratedCaches(root);
  try {
    runNode(root, "scripts/validate-site.mjs", logs);
    runNode(root, "scripts/validate-game-filters.mjs", logs);
    runNode(root, "scripts/validate-backend.mjs", logs);
    runProjectBinary(
      root,
      path.join("node_modules", "next", "dist", "bin", "next"),
      ["typegen"],
      "Next.js route type generation",
      logs,
      40 * 1024 * 1024,
    );
    runProjectBinary(
      root,
      path.join("node_modules", "typescript", "bin", "tsc"),
      ["--noEmit"],
      "TypeScript validation",
      logs,
      40 * 1024 * 1024,
    );
  } finally {
    // typegen and incremental TypeScript recreate these caches. They are not
    // site source, so remove them again to keep the next apply deterministic.
    cleanGeneratedCaches(root);
  }
  if (writeOutput) {
    const output = logs.filter(Boolean).join("\n");
    if (output) process.stdout.write(`${output}\n`);
  }
  return logs.filter(Boolean);
}
