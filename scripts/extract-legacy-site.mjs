import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractLegacySite } from "./legacy-site-extractor-tools.mjs";
import { parseArguments, writeJson } from "./template-tools.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArguments(process.argv.slice(2));

if (!args.target) {
  console.error("Usage: npm run site:extract-legacy -- --target <legacy-site> [--output <blueprint.json>] [--report <report.json>] [--base <blueprint.json>]");
  process.exitCode = 1;
} else {
  const result = extractLegacySite({
    targetRoot: path.resolve(String(args.target)),
    templateRoot: root,
    baseBlueprintPath: args.base
      ? path.resolve(String(args.base))
      : path.join(root, "site", "blueprint.json"),
  });

  if (args.output && result.blueprint) writeJson(path.resolve(String(args.output)), result.blueprint);
  if (args.report) writeJson(path.resolve(String(args.report)), result.report);

  const summary = {
    mode: args.output || args.report ? "report-output" : "read-only-preview",
    status: result.report.status,
    site: result.report.site,
    counts: result.report.counts,
    blueprintOutput: args.output ? path.resolve(String(args.output)) : null,
    reportOutput: args.report ? path.resolve(String(args.report)) : null,
    issues: result.report.issues,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (result.report.status === "blocked") process.exitCode = 2;
}
