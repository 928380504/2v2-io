import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { parseArguments, writeJson } from "./template-tools.mjs";
import {
  applyCompetitionInstall,
  buildCompetitionInstallAudit,
  listCompetitionPacks,
} from "./competition-installer-tools.mjs";

const root = process.cwd();
const args = parseArguments(process.argv.slice(2));

function usage() {
  console.log(`
Install a built-in competition adapter pack. Preview is the default.

List available packs:
  npm run competition:install -- --list

Preview:
  npm run competition:install -- --adapter word-score

Apply with backup and rollback protection:
  npm run competition:install -- --adapter word-score --apply

The command changes only site configuration and protected migration history.
It never executes SQL against a remote D1 database or deploys the website.
`);
}

function runNodeScript(relativePath) {
  const result = spawnSync(process.execPath, [path.join(root, relativePath)], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 20 * 1024 * 1024,
  });
  process.stdout.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
  if (result.status !== 0) throw new Error(`${relativePath} failed.`);
}

function validateInstalledSite() {
  runNodeScript("scripts/validate-backend.mjs");
  runNodeScript("scripts/validate-site.mjs");
  const typeScriptPath = path.join(root, "node_modules", "typescript", "bin", "tsc");
  if (!fs.existsSync(typeScriptPath)) {
    throw new Error("TypeScript is not installed. Run npm install before applying an adapter.");
  }
  const result = spawnSync(process.execPath, [typeScriptPath, "--noEmit"], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 30 * 1024 * 1024,
  });
  process.stdout.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
  if (result.status !== 0) throw new Error("TypeScript validation failed.");
}

try {
  const packs = listCompetitionPacks(root);
  if (args.help) {
    usage();
    process.exit(0);
  }
  if (args.list) {
    console.log(`Competition packs: ${packs.length}`);
    packs.forEach((pack) => {
      console.log(
        `- ${pack.id}: ${pack.displayName} · mode=${pack.modeKey} · metric=${pack.competition.metricField}`,
      );
    });
    process.exit(0);
  }
  if (!args.adapter) {
    usage();
    throw new Error("--adapter is required unless --list is used.");
  }
  const requestedId = String(args.adapter).trim();
  const pack = packs.find((candidate) => candidate.id === requestedId);
  if (!pack) {
    throw new Error(
      `Unknown competition adapter ${requestedId}. Available: ${packs.map((item) => item.id).join(", ")}.`,
    );
  }

  const audit = buildCompetitionInstallAudit({ root, pack });
  console.log(`Competition adapter install: ${audit.status}`);
  console.log(`Pack: ${pack.id} (${pack.displayName})`);
  console.log(`Adapter: ${audit.currentAdapterId || "unknown"} -> ${pack.adapterId}`);
  console.log(`Mode: ${pack.modeKey}`);
  console.log(`Metric: ${pack.competition.metricField} (${pack.competition.metricLabel})`);
  console.log(`Migration: ${audit.targetMigrationPath || "existing adapter migrations"}`);
  audit.changes.forEach((file) => console.log(`  change ${file}`));
  audit.blockers.forEach((message) => console.log(`Blocker: ${message}`));

  if (!args.apply) {
    console.log("Preview only; no files changed. Add --apply after reviewing this plan.");
    process.exit(0);
  }
  if (audit.status === "blocked") {
    throw new Error("Competition adapter installation stopped before writing.");
  }
  if (audit.status === "current") {
    console.log("Competition adapter is already installed and selected; no files changed.");
    process.exit(0);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupRoot = path.join(root, "backups", "competition-install", timestamp);
  writeJson(path.join(backupRoot, "install-plan.json"), {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    adapterId: pack.adapterId,
    previousAdapterId: audit.currentAdapterId,
    additions: audit.additions,
    updates: audit.updates,
    targetMigrationPath: audit.targetMigrationPath,
  });
  applyCompetitionInstall({
    root,
    audit,
    backupRoot,
    validate: validateInstalledSite,
  });

  console.log(`Competition adapter installed: ${pack.adapterId}`);
  console.log(`Backup: ${path.relative(root, backupRoot)}`);
  console.log("Next: review npm run migrations:list, apply the new SQL to the target D1 database, then run npm run build.");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

