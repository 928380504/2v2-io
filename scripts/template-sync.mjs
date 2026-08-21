import fs from "node:fs";
import path from "node:path";
import {
  classifyTemplateFile,
  diffFileMaps,
  hashFile,
  parseArguments,
  readJson,
  resolveInside,
  scanCoreFiles,
  writeJson,
} from "./template-tools.mjs";

const sourceRoot = process.cwd();
const args = parseArguments(process.argv.slice(2));

function usage() {
  console.log(`
Preview a template update:
  npm run template:sync -- --target "H:\\path\\to\\game-site"

Apply a reviewed update (creates a backup first):
  npm run template:sync -- --target "H:\\path\\to\\game-site" --apply

Adopt an existing site before its first update:
  npm run template:sync -- --target "H:\\path\\to\\game-site" --adopt --apply

Resolve locally modified core files only after manual review:
  npm run template:sync -- --target "H:\\path\\to\\game-site" --apply --force-conflicts
`);
}

function ensureSafeDefinition(definition) {
  const protectedPaths = (definition.protectedPaths || []).map((item) => `${item.replace(/\\/g, "/").replace(/\/$/, "")}/`);
  for (const corePathValue of definition.corePaths || []) {
    const corePath = `${corePathValue.replace(/\\/g, "/").replace(/\/$/, "")}/`;
    const overlap = protectedPaths.find(
      (protectedPath) => corePath.startsWith(protectedPath) || protectedPath.startsWith(corePath),
    );
    if (overlap) {
      throw new Error(`Core path overlaps protected path: ${corePathValue} / ${overlap.slice(0, -1)}`);
    }
  }
}

function printGroup(label, values) {
  console.log(`${label}: ${values.length}`);
  values.slice(0, 60).forEach((value) => console.log(`  ${value}`));
  if (values.length > 60) console.log(`  ...and ${values.length - 60} more`);
}

if (args.help || !args.target) {
  usage();
  process.exit(args.help ? 0 : 1);
}

try {
  const targetRoot = path.resolve(String(args.target));
  if (targetRoot.toLowerCase() === path.resolve(sourceRoot).toLowerCase()) {
    throw new Error("The update target cannot be the template source itself.");
  }
  if (!fs.existsSync(targetRoot) || !fs.statSync(targetRoot).isDirectory()) {
    throw new Error(`Target directory does not exist: ${targetRoot}`);
  }
  for (const required of ["package.json", "site/manifest.json"]) {
    if (!fs.existsSync(resolveInside(targetRoot, required))) {
      throw new Error(`Target is not an initialized game-template site; missing ${required}.`);
    }
  }

  const definition = readJson(path.join(sourceRoot, "template", "template.json"));
  const sourceRelease = readJson(path.join(sourceRoot, "template", "release-manifest.json"));
  ensureSafeDefinition(definition);

  const currentSourceFiles = scanCoreFiles(sourceRoot, definition);
  const sourceDiff = diffFileMaps(sourceRelease.files || {}, currentSourceFiles);
  if (
    sourceRelease.templateId !== definition.templateId ||
    sourceRelease.version !== definition.version ||
    sourceDiff.added.length ||
    sourceDiff.changed.length ||
    sourceDiff.removed.length
  ) {
    throw new Error("Template source has unreleased core changes. Run npm run template:release first.");
  }

  const targetReleasePath = path.join(targetRoot, "template", "release-manifest.json");
  if (args.adopt) {
    if (fs.existsSync(targetReleasePath) && !args["force-adopt"]) {
      throw new Error("Target already has a release manifest. Remove --adopt or use --force-adopt after review.");
    }
    const adoptedFiles = scanCoreFiles(targetRoot, definition, { allowMissing: true });
    console.log(`Adoption baseline: ${Object.keys(adoptedFiles).length} existing core files.`);
    console.log("No site, public, Functions, migration or environment files are included.");
    if (!args.apply) {
      console.log("Preview only; add --apply to write the adoption baseline.");
      process.exit(0);
    }
    if (fs.existsSync(targetReleasePath)) {
      const backupPath = path.join(
        targetRoot,
        "backups",
        "template-upgrade",
        new Date().toISOString().replace(/[:.]/g, "-"),
        "template/release-manifest.json",
      );
      fs.mkdirSync(path.dirname(backupPath), { recursive: true });
      fs.copyFileSync(targetReleasePath, backupPath);
    }
    writeJson(targetReleasePath, {
      schemaVersion: 1,
      templateId: definition.templateId,
      version: "0.0.0-adopted",
      generatedAt: new Date().toISOString(),
      files: adoptedFiles,
    });
    console.log(`Target adopted. Next run template:sync without --adopt to preview ${definition.version}.`);
    process.exit(0);
  }

  if (!fs.existsSync(targetReleasePath)) {
    throw new Error("Target has no release baseline. Run template:sync with --adopt --apply first.");
  }
  const targetRelease = readJson(targetReleasePath);
  if (targetRelease.templateId !== definition.templateId) {
    throw new Error(`Template ID mismatch: target=${targetRelease.templateId}, source=${definition.templateId}`);
  }

  const additions = [];
  const updates = [];
  const removals = [];
  const conflicts = [];
  const unchanged = [];
  const preserved = [];
  const previousFiles = targetRelease.files || {};

  Object.entries(sourceRelease.files).forEach(([relativePath, sourceHash]) => {
    const targetPath = resolveInside(targetRoot, relativePath);
    const targetExists = fs.existsSync(targetPath);
    const targetIsFile = targetExists && fs.statSync(targetPath).isFile();
    const targetHash = targetIsFile ? hashFile(targetPath) : null;
    const classification = classifyTemplateFile({
      sourceHash,
      previousHash: previousFiles[relativePath],
      targetHash,
      targetExists,
      targetIsFile,
    });
    if (classification === "add") additions.push(relativePath);
    else if (classification === "update") updates.push(relativePath);
    else if (classification === "preserved") preserved.push(relativePath);
    else if (classification === "unchanged") unchanged.push(relativePath);
    else conflicts.push(relativePath);
  });

  Object.entries(previousFiles).forEach(([relativePath, previousHash]) => {
    if (relativePath in sourceRelease.files) return;
    const targetPath = resolveInside(targetRoot, relativePath);
    if (!fs.existsSync(targetPath)) return;
    if (fs.statSync(targetPath).isFile() && hashFile(targetPath) === previousHash) {
      removals.push(relativePath);
    } else if (!conflicts.includes(relativePath)) {
      conflicts.push(relativePath);
    }
  });

  console.log(`Template update ${targetRelease.version} -> ${sourceRelease.version}`);
  printGroup("Add", additions);
  printGroup("Update", updates);
  printGroup("Remove", removals);
  printGroup("Local conflicts", conflicts);
  printGroup("Preserved local", preserved);
  console.log(`Unchanged: ${unchanged.length}`);
  console.log(`Protected: ${(definition.protectedPaths || []).join(", ")}`);

  if (!args.apply) {
    console.log("Preview only; no files changed. Add --apply after reviewing this plan.");
    process.exit(0);
  }
  if (conflicts.length > 0 && !args["force-conflicts"]) {
    throw new Error("Update stopped before writing because local core conflicts exist. Move custom work to site/overrides or review --force-conflicts.");
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupRoot = path.join(targetRoot, "backups", "template-upgrade", timestamp);
  const overwritten = [
    ...updates,
    ...removals,
    ...(args["force-conflicts"] ? conflicts : []),
  ];
  overwritten.forEach((relativePath) => {
    const targetPath = resolveInside(targetRoot, relativePath);
    if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isFile()) return;
    const backupPath = resolveInside(backupRoot, relativePath);
    fs.mkdirSync(path.dirname(backupPath), { recursive: true });
    fs.copyFileSync(targetPath, backupPath);
  });

  [...additions, ...updates, ...(args["force-conflicts"] ? conflicts : [])]
    .forEach((relativePath) => {
      const sourcePath = resolveInside(sourceRoot, relativePath);
      if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) return;
      const targetPath = resolveInside(targetRoot, relativePath);
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.copyFileSync(sourcePath, targetPath);
    });

  removals.forEach((relativePath) => {
    const targetPath = resolveInside(targetRoot, relativePath);
    if (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
      fs.unlinkSync(targetPath);
    }
  });

  writeJson(targetReleasePath, sourceRelease);
  console.log(`Template update applied. Backup: ${path.relative(targetRoot, backupRoot)}`);
  console.log("Run npm install, npm run validate-site and npm run build in the target site.");
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
