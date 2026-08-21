import path from "node:path";
import { parseArguments } from "./template-tools.mjs";
import {
  applyBlueprintExportPlan,
  buildBlueprintExportPlan,
} from "./site-blueprint-export-tools.mjs";

const root = process.cwd();
const args = parseArguments(process.argv.slice(2));

function usage() {
  console.log(`
Export the current protected site package into one editable blueprint.

Preview (default):
  npm run site:export

Write site/blueprint.json with a recoverable backup:
  npm run site:export -- --apply
`);
}

try {
  if (args.help) {
    usage();
    process.exit(0);
  }
  const plan = buildBlueprintExportPlan(root);
  console.log(`Site blueprint export: ${plan.status}`);
  console.log(`Site: ${plan.blueprint.site.name} (${plan.blueprint.site.domain})`);
  console.log(`Games: ${plan.blueprint.games.length}`);
  console.log(`Filters: ${plan.blueprint.filters.groups.length}`);
  console.log(`Target: ${path.relative(root, plan.targetPath)}`);
  if (!args.apply) {
    console.log("Preview only; no files changed. Add --apply to write the editable blueprint.");
    process.exit(0);
  }
  if (plan.status === "current") {
    console.log("The editable blueprint already matches the current site package.");
    process.exit(0);
  }
  const result = applyBlueprintExportPlan(root, plan);
  console.log(`Blueprint written: ${path.relative(root, result.targetPath)}`);
  if (result.backupPath) console.log(`Backup: ${path.relative(root, result.backupPath)}`);
  console.log("Next: run npm run site:create to preview regenerating the site from this blueprint.");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
