import path from "node:path";
import { parseArguments, writeJson } from "./template-tools.mjs";
import { cleanGeneratedCaches } from "./generated-cache-tools.mjs";
import { validateCreatedSite } from "./site-validation-tools.mjs";
import {
  applySiteCreationPlan,
  buildSiteCreationPlan,
  readSiteBlueprint,
} from "./site-creator-tools.mjs";

const root = process.cwd();
const args = parseArguments(process.argv.slice(2));

function usage() {
  console.log(`
Generate a complete site-owned package from one JSON blueprint.

Preview (default):
  npm run site:create
  npm run site:create -- --from examples/site-blueprint.example.json

Apply with backup, validation and rollback:
  npm run site:create -- --from path/to/site-blueprint.json --apply

The command writes protected site-owned files. It does not download assets,
execute D1 SQL, deploy the site, or overwrite public/ and functions/. A newly
selected built-in adapter may append its packaged immutable migration.
`);
}

try {
  if (args.help) {
    usage();
    process.exit(0);
  }
  const sourcePath = args.from
    ? path.resolve(root, String(args.from))
    : path.join(root, "site", "blueprint.json");
  if (args.apply) {
    const removedCaches = cleanGeneratedCaches(root);
    if (removedCaches.length) console.log(`Generated caches cleared: ${removedCaches.join(", ")}`);
  }
  const blueprint = readSiteBlueprint(sourcePath);
  const plan = buildSiteCreationPlan({ root, blueprint });

  console.log(`Site creation: ${plan.status}`);
  console.log(`Blueprint: ${path.relative(root, sourcePath)}`);
  console.log(`Site: ${plan.blueprint.site.name} (${plan.blueprint.site.domain})`);
  console.log(`Games: ${plan.blueprint.games.length}`);
  console.log(`Category: ${plan.blueprint.category.id} -> ${plan.blueprint.routes.categoryPath}`);
  console.log(`Filters: ${plan.blueprint.filters.groups.length} groups -> ${plan.blueprint.routes.filterPath}`);
  console.log(`Competition: ${plan.blueprint.competition.adapterId}`);
  console.log(`Files: ${plan.updates.length} updates, ${plan.additions.length} additions`);
  plan.changes.forEach((file) => console.log(`  change ${file}`));

  const checklist = JSON.parse(
    plan.writes.get(path.join(root, "site", "generated", "resource-checklist.json")),
  );
  const missing = checklist.resources.filter((resource) => resource.status === "missing");
  if (missing.length) {
    console.log(`Missing local resources: ${missing.length}`);
    missing.forEach((resource) => console.log(`  missing ${resource.value} (${resource.owner}/${resource.kind})`));
  }

  if (!args.apply) {
    console.log("Preview only; no files changed. Add --apply after supplying missing local resources and reviewing this plan.");
    process.exit(0);
  }
  if (plan.status === "current") {
    console.log("The generated site package already matches this blueprint; no files changed.");
    process.exit(0);
  }
  if (missing.length) {
    throw new Error("Apply stopped: supply the missing local resources listed above first.");
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupRoot = path.join(root, "backups", "site-create", timestamp);
  writeJson(path.join(backupRoot, "creation-plan.json"), {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    blueprint: path.relative(root, sourcePath).replaceAll("\\", "/"),
    siteId: plan.blueprint.site.id,
    updates: plan.updates,
    additions: plan.additions,
  });
  applySiteCreationPlan({
    root,
    plan,
    backupRoot,
    validate: () => validateCreatedSite(root, { writeOutput: true }),
  });
  console.log(`Site package created: ${plan.blueprint.site.id}`);
  console.log(`Backup: ${path.relative(root, backupRoot)}`);
  console.log("Next: review site/generated/resource-checklist.json, run cloudflare:provision for a new site, and then run npm run build.");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
