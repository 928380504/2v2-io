import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { parseArguments, readJson, writeJson } from "./template-tools.mjs";
import {
  fleetTotals,
  normalizeFleetConfiguration,
  parseSyncOutput,
  validateTargetDirectory,
} from "./template-fleet-tools.mjs";

const root = process.cwd();
const args = parseArguments(process.argv.slice(2));

function usage() {
  console.log(`
Preview every enabled website:
  npm run template:fleet

Preview selected websites:
  npm run template:fleet -- --site 1v1-lol,temple-run

Apply reviewed updates (each site is backed up independently):
  npm run template:fleet -- --apply

Adopt selected existing sites before their first update:
  npm run template:fleet -- --site 1v1-lol --adopt --apply

Options:
  --config <path>       Fleet registry (default: template/sites.json)
  --site <id,id>        Restrict the run to selected site IDs
  --apply               Apply updates; preview is the default
  --adopt               Create baselines instead of updating
  --force-adopt         Replace an existing adoption baseline after review
  --force-conflicts     Replace locally modified core files after review
  --details             Print the complete single-site updater output
  --no-report           Do not write template/reports/latest.json
`);
}

function errorSummary(output) {
  return String(output || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-3)
    .join(" ");
}

if (args.help) {
  usage();
  process.exit(0);
}

try {
  const configurationPath = path.resolve(
    root,
    String(args.config || path.join("template", "sites.json")),
  );
  if (!fs.existsSync(configurationPath)) {
    throw new Error(
      `Fleet registry not found: ${configurationPath}. Copy template/sites.example.json to template/sites.json.`,
    );
  }
  const definition = readJson(path.join(root, "template", "template.json"));
  const sites = normalizeFleetConfiguration(readJson(configurationPath), configurationPath);
  const requestedIds = args.site
    ? new Set(String(args.site).split(",").map((value) => value.trim()).filter(Boolean))
    : null;
  if (requestedIds) {
    const knownIds = new Set(sites.map((site) => site.id));
    const unknown = [...requestedIds].filter((id) => !knownIds.has(id));
    if (unknown.length) throw new Error(`Unknown fleet site ID(s): ${unknown.join(", ")}.`);
  }
  const selectedSites = sites.filter(
    (site) => site.enabled && (!requestedIds || requestedIds.has(site.id)),
  );
  if (selectedSites.length === 0) {
    throw new Error("No enabled websites matched this fleet run.");
  }

  const apply = args.apply === true;
  const adopt = args.adopt === true;
  const syncScript = path.join(root, "scripts", "template-sync.mjs");
  const results = [];

  console.log(
    `Template fleet ${apply ? "apply" : "preview"}: ${selectedSites.length} site(s), source ${definition.version}.`,
  );
  for (const site of selectedSites) {
    const targetError = validateTargetDirectory(site.path);
    if (targetError) {
      results.push({
        id: site.id,
        name: site.name,
        path: site.path,
        status: "failed",
        fromVersion: null,
        toVersion: definition.version,
        changes: { add: 0, update: 0, remove: 0, conflicts: 0, unchanged: 0 },
        message: targetError,
      });
      console.log(`[FAILED] ${site.id}: ${targetError}`);
      continue;
    }

    const childArguments = [syncScript, "--target", site.path];
    if (apply) childArguments.push("--apply");
    if (adopt) childArguments.push("--adopt");
    if (args["force-adopt"]) childArguments.push("--force-adopt");
    if (args["force-conflicts"]) childArguments.push("--force-conflicts");
    const child = spawnSync(process.execPath, childArguments, {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 20 * 1024 * 1024,
    });
    const output = `${child.stdout || ""}${child.stderr || ""}`;
    const parsed = parseSyncOutput(output, {
      apply,
      adopt,
      success: child.status === 0,
    });
    const result = {
      id: site.id,
      name: site.name,
      path: site.path,
      ...parsed,
      toVersion: parsed.toVersion || definition.version,
      message: child.status === 0 ? null : errorSummary(output),
    };
    results.push(result);
    const counts = result.changes;
    console.log(
      `[${result.status.toUpperCase()}] ${site.id}: ${result.fromVersion || "unversioned"} -> ${result.toVersion} ` +
        `(add ${counts.add}, update ${counts.update}, remove ${counts.remove}, preserve ${counts.preserved}, conflicts ${counts.conflicts})`,
    );
    if (result.message) console.log(`  ${result.message}`);
    if (args.details) process.stdout.write(`\n${output.trim()}\n\n`);
  }

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    templateId: definition.templateId,
    templateVersion: definition.version,
    mode: adopt ? (apply ? "adopt" : "adopt-preview") : (apply ? "apply" : "preview"),
    configuration: path.relative(root, configurationPath).replaceAll("\\", "/"),
    totals: fleetTotals(results),
    sites: results,
  };
  if (!args["no-report"]) {
    const reportPath = path.join(root, "template", "reports", "latest.json");
    writeJson(reportPath, report);
    console.log(`Report: ${path.relative(root, reportPath)}`);
  }
  const failed = results.filter((result) => result.status === "failed").length;
  const conflicts = results.filter((result) => result.status === "conflict").length;
  console.log(
    `Summary: ${results.length} site(s), ${failed} failed, ${conflicts} with conflicts.`,
  );
  if (failed > 0 || (apply && conflicts > 0)) process.exitCode = 1;
} catch (error) {
  usage();
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
