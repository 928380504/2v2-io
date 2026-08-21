import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { parseArguments, writeJson } from "./template-tools.mjs";
import {
  buildFunctionsMigrationAudit,
  copyFunctionMigration,
  rollbackFunctionMigration,
} from "./functions-migration-tools.mjs";

const templateRoot = process.cwd();
const args = parseArguments(process.argv.slice(2));

function usage() {
  console.log(`
Audit protected Pages Functions (preview only):
  npm run functions:migrate -- --target "H:\\path\\to\\game-site"

Apply after site adoption and core update:
  npm run functions:migrate -- --target "H:\\path\\to\\game-site" --apply

This command backs up every replaced Function, preserves target-only routes,
and never modifies D1 migrations, public assets or environment files.
`);
}

if (args.help || !args.target) {
  usage();
  process.exit(args.help ? 0 : 1);
}

try {
  const targetRoot = path.resolve(String(args.target));
  if (targetRoot.toLowerCase() === path.resolve(templateRoot).toLowerCase()) {
    throw new Error("The Functions migration target cannot be the template source itself.");
  }
  const audit = buildFunctionsMigrationAudit({ templateRoot, targetRoot });
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    mode: args.apply ? "apply" : "preview",
    ...audit,
  };
  const reportPath = path.join(
    templateRoot,
    "template",
    "reports",
    "functions-migration-latest.json",
  );
  writeJson(reportPath, report);

  console.log(`Pages Functions migration ${audit.status}: ${targetRoot}`);
  console.log(`Public API routes: ${audit.routeCount}`);
  console.log(`Add: ${audit.additions.length}`);
  console.log(`Replace: ${audit.updates.length}`);
  console.log(`Unchanged: ${audit.unchanged.length}`);
  console.log(`Target-only preserved: ${audit.extras.length}`);
  audit.updates.forEach((relativePath) => console.log(`  replace functions/${relativePath}`));
  audit.additions.forEach((relativePath) => console.log(`  add functions/${relativePath}`));
  audit.extras.forEach((relativePath) => console.log(`  preserve functions/${relativePath}`));
  audit.blockers.forEach((message) => console.log(`Blocker: ${message}`));
  console.log("Protected: migrations, public assets and environment files remain untouched.");
  console.log(`Report: ${path.relative(templateRoot, reportPath)}`);

  if (!args.apply) {
    console.log("Preview only; no target files changed. Add --apply after core migration and review.");
    process.exit(0);
  }
  if (audit.status === "blocked") {
    throw new Error("Functions migration stopped before writing because prerequisites are missing.");
  }
  if (audit.status === "current") {
    console.log("Pages Functions already use the current wrapper layer; no files changed.");
    process.exit(0);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupRoot = path.join(targetRoot, "backups", "functions-migration", timestamp);
  writeJson(path.join(backupRoot, "migration-plan.json"), report);
  copyFunctionMigration({
    templateRoot,
    targetRoot,
    additions: audit.additions,
    updates: audit.updates,
    backupRoot,
  });
  let validated = false;
  try {
    const validation = spawnSync(
      process.execPath,
      [path.join(targetRoot, "scripts", "validate-backend.mjs")],
      {
        cwd: targetRoot,
        encoding: "utf8",
        windowsHide: true,
        maxBuffer: 20 * 1024 * 1024,
      },
    );
    process.stdout.write(validation.stdout || "");
    process.stderr.write(validation.stderr || "");
    if (validation.status !== 0) throw new Error("Backend validation failed after Functions migration.");
    validated = true;
  } finally {
    if (!validated) {
      rollbackFunctionMigration({
        targetRoot,
        additions: audit.additions,
        updates: audit.updates,
        backupRoot,
      });
    }
  }
  console.log(`Pages Functions migration applied. Backup: ${path.relative(targetRoot, backupRoot)}`);
  console.log("Next: run the target site's full production build before deployment.");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
