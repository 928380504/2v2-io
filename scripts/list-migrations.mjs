import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const args = process.argv.slice(2);
const adapterArgument = args.find((value) => value.startsWith("--adapter="));
const adapterIndex = args.indexOf("--adapter");
const configuredAdapter = fs
  .readFileSync(path.join(root, "site", "backend.ts"), "utf8")
  .match(/competitionAdapterId:\s*["']([^"']+)["']/)?.[1];
const adapter =
  adapterArgument?.slice("--adapter=".length) ||
  (adapterIndex >= 0 ? args[adapterIndex + 1] : undefined) ||
  configuredAdapter;

const siteManifestPath = path.join(root, "site", "competition-migrations.json");
const manifestPath = fs.existsSync(siteManifestPath)
  ? siteManifestPath
  : path.join(root, "backend", "migrations.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
if (!adapter || !manifest.groups?.[adapter]) {
  console.error(`Unknown or missing competition adapter: ${adapter || "none"}`);
  process.exit(1);
}

const files = [...new Set([
  ...(manifest.groups.community || []),
  ...manifest.groups[adapter]
])].sort((left, right) => {
  const leftNumber = Number(path.basename(left).match(/^(\d+)_/)?.[1]);
  const rightNumber = Number(path.basename(right).match(/^(\d+)_/)?.[1]);
  return leftNumber - rightNumber;
});

console.log(`Migration plan: community + ${adapter}`);
files.forEach((file) => console.log(file));
