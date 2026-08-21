import path from "node:path";
import {
  diffFileMaps,
  parseArguments,
  readJson,
  scanCoreFiles,
  writeJson,
} from "./template-tools.mjs";
import { validateTemplateDocs } from "./validate-template-docs.mjs";

const root = process.cwd();
const definitionPath = path.join(root, "template", "template.json");
const releasePath = path.join(root, "template", "release-manifest.json");
const args = parseArguments(process.argv.slice(2));
const semverPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

let definition = readJson(definitionPath);
const releaseVersion = String(args.version || definition.version);
const documentationErrors = validateTemplateDocs({
  root,
  expectedVersion: releaseVersion,
});
if (documentationErrors.length) {
  documentationErrors.forEach((message) => console.error(`ERROR ${message}`));
  console.error("Template release stopped because documentation is out of sync.");
  process.exit(1);
}

if (args.version) {
  if (!semverPattern.test(String(args.version))) {
    console.error("--version must use semantic versioning, for example 2.1.0.");
    process.exit(1);
  }
  definition = { ...definition, version: String(args.version) };
  if (!args.check) writeJson(definitionPath, definition);
}

const files = scanCoreFiles(root, definition);

if (args.check) {
  let release;
  try {
    release = readJson(releasePath);
  } catch {
    console.error("No release manifest exists. Run npm run template:release first.");
    process.exit(1);
  }
  const diff = diffFileMaps(release.files || {}, files);
  if (
    release.templateId !== definition.templateId ||
    release.version !== definition.version ||
    diff.added.length ||
    diff.changed.length ||
    diff.removed.length
  ) {
    console.error(`Template release ${release.version || "unknown"} is stale.`);
    [...diff.added.map((item) => `ADD ${item}`),
      ...diff.changed.map((item) => `CHANGE ${item}`),
      ...diff.removed.map((item) => `REMOVE ${item}`)]
      .slice(0, 100)
      .forEach((line) => console.error(line));
    process.exit(1);
  }
  console.log(`Template release verified: ${release.version}, ${Object.keys(files).length} core files.`);
  process.exit(0);
}

const release = {
  schemaVersion: 1,
  templateId: definition.templateId,
  version: definition.version,
  generatedAt: new Date().toISOString(),
  files,
};
writeJson(releasePath, release);
console.log(`Template release created: ${release.version}, ${Object.keys(files).length} core files.`);
