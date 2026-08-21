import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { parseArguments, writeJson } from "./template-tools.mjs";
import {
  buildLegacyAdoptionAudit,
  copySitePackage,
} from "./legacy-adoption-tools.mjs";

const templateRoot = process.cwd();
const args = parseArguments(process.argv.slice(2));

function usage() {
  console.log(`
Audit a legacy game site (preview only):
  npm run site:adopt-legacy -- --target "H:\\path\\to\\legacy-site"

Bootstrap the protected site package and create an adoption baseline:
  npm run site:adopt-legacy -- --target "H:\\path\\to\\legacy-site" --apply

Use a prepared site package for another domain:
  npm run site:adopt-legacy -- --target "H:\\path\\to\\legacy-site" --site-package "H:\\path\\to\\prepared-site-package"

The command never updates legacy core files, public assets, Pages Functions,
D1 migrations or environment files. After adoption, run template:fleet to
preview the actual core update.
`);
}

if (args.help || !args.target) {
  usage();
  process.exit(args.help ? 0 : 1);
}

try {
  const targetRoot = path.resolve(String(args.target));
  const sitePackageRoot = path.resolve(
    templateRoot,
    String(args["site-package"] || "site"),
  );
  if (targetRoot.toLowerCase() === templateRoot.toLowerCase()) {
    throw new Error("The legacy target cannot be the template source itself.");
  }
  const audit = buildLegacyAdoptionAudit({
    targetRoot,
    sitePackageRoot,
    templateRoot,
  });
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
    "legacy-adoption-latest.json",
  );
  writeJson(reportPath, report);

  console.log(`Legacy adoption ${audit.status}: ${targetRoot}`);
  console.log(`Domain: ${audit.inferredDomain || "unknown"} / package ${audit.packageDomain || "unknown"}`);
  console.log(`Routes found: ${audit.routeCount}`);
  console.log(`Legacy configuration files: ${audit.legacyConfigurationFiles.length}`);
  console.log(`Site package files to add: ${audit.sitePackageFileCount}`);
  console.log(
    `Protected Functions: ${audit.functionsComparison.different.length} different, ` +
      `${audit.functionsComparison.missing.length} missing, ` +
      `${audit.functionsComparison.identical.length} identical`,
  );
  audit.manualFollowUp.forEach((message) => console.log(`Manual follow-up: ${message}`));
  audit.blockers.forEach((message) => console.log(`Blocker: ${message}`));
  console.log(`Report: ${path.relative(templateRoot, reportPath)}`);

  if (!args.apply) {
    console.log("Preview only; no target files changed. Add --apply after reviewing the report.");
    process.exit(0);
  }
  if (audit.status !== "ready") {
    throw new Error("Adoption stopped before writing because the audit contains blockers.");
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupRoot = path.join(targetRoot, "backups", "template-adoption", timestamp);
  writeJson(path.join(backupRoot, "adoption-plan.json"), report);
  const targetSiteRoot = path.join(targetRoot, "site");
  const createdFiles = copySitePackage(sitePackageRoot, targetSiteRoot);
  let adopted = false;
  try {
    const adoption = spawnSync(
      process.execPath,
      [
        path.join(templateRoot, "scripts", "template-sync.mjs"),
        "--target",
        targetRoot,
        "--adopt",
        "--apply",
      ],
      {
        cwd: templateRoot,
        encoding: "utf8",
        windowsHide: true,
        maxBuffer: 20 * 1024 * 1024,
      },
    );
    process.stdout.write(adoption.stdout || "");
    process.stderr.write(adoption.stderr || "");
    if (adoption.status !== 0) throw new Error("Template baseline creation failed.");
    adopted = true;
  } finally {
    if (!adopted) {
      for (const relativePath of [...createdFiles].reverse()) {
        const targetPath = path.join(targetSiteRoot, relativePath);
        if (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) fs.unlinkSync(targetPath);
      }
      if (path.dirname(path.resolve(targetSiteRoot)).toLowerCase() !== path.resolve(targetRoot).toLowerCase()) {
        throw new Error("Refusing to remove an adoption rollback path outside the target root.");
      }
      fs.rmSync(targetSiteRoot, { recursive: true, force: true });
    }
  }
  console.log(`Legacy site adopted with ${createdFiles.length} protected site-package files.`);
  console.log("No legacy core files were updated. Next: run npm run template:fleet and review the update plan.");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
