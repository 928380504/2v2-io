import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const TEXT_FILE_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".sql",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);

const TEXT_FILE_NAMES = new Set([
  ".editorconfig",
  ".gitattributes",
  ".gitignore",
  "dockerfile",
  "license",
]);

export function normalizeRelativePath(value) {
  return value.split(path.sep).join("/").replace(/^\.\//, "");
}

export function resolveInside(root, relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  if (!normalized || path.isAbsolute(normalized) || normalized.split("/").includes("..")) {
    throw new Error(`Unsafe template path: ${relativePath}`);
  }
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, ...normalized.split("/"));
  const prefix = `${resolvedRoot}${path.sep}`.toLowerCase();
  if (resolved.toLowerCase() !== resolvedRoot.toLowerCase() && !resolved.toLowerCase().startsWith(prefix)) {
    throw new Error(`Template path escapes target root: ${relativePath}`);
  }
  return resolved;
}

export function hashFile(filePath) {
  const contents = fs.readFileSync(filePath);
  const fileName = path.basename(filePath).toLowerCase();
  const extension = path.extname(fileName);
  const normalizedContents =
    TEXT_FILE_EXTENSIONS.has(extension) || TEXT_FILE_NAMES.has(fileName)
      ? Buffer.from(contents.toString("utf8").replace(/\r\n/g, "\n"), "utf8")
      : contents;
  return crypto.createHash("sha256").update(normalizedContents).digest("hex");
}

function walkDirectory(root, directory, files) {
  const entries = fs.readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`Symbolic links are not supported in template core: ${absolutePath}`);
    }
    if (entry.isDirectory()) {
      walkDirectory(root, absolutePath, files);
    } else if (entry.isFile()) {
      files[normalizeRelativePath(path.relative(root, absolutePath))] = hashFile(absolutePath);
    }
  }
}

export function scanCoreFiles(root, definition, { allowMissing = false } = {}) {
  const files = {};
  for (const corePath of definition.corePaths || []) {
    const absolutePath = resolveInside(root, corePath);
    if (!fs.existsSync(absolutePath)) {
      if (allowMissing) continue;
      throw new Error(`Configured core path does not exist: ${corePath}`);
    }
    const stats = fs.lstatSync(absolutePath);
    if (stats.isSymbolicLink()) {
      throw new Error(`Symbolic links are not supported in template core: ${corePath}`);
    }
    if (stats.isDirectory()) {
      walkDirectory(root, absolutePath, files);
    } else if (stats.isFile()) {
      files[normalizeRelativePath(corePath)] = hashFile(absolutePath);
    }
  }
  return Object.fromEntries(Object.entries(files).sort(([left], [right]) => left.localeCompare(right)));
}

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function parseArguments(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 1) {
    const token = values[index];
    if (!token.startsWith("--")) continue;
    const [key, inlineValue] = token.slice(2).split(/=(.*)/s, 2);
    if (inlineValue !== undefined) result[key] = inlineValue;
    else if (values[index + 1] && !values[index + 1].startsWith("--")) {
      result[key] = values[index + 1];
      index += 1;
    } else result[key] = true;
  }
  return result;
}

export function diffFileMaps(expected, actual) {
  const added = [];
  const changed = [];
  const removed = [];
  Object.entries(actual).forEach(([filePath, hash]) => {
    if (!(filePath in expected)) added.push(filePath);
    else if (expected[filePath] !== hash) changed.push(filePath);
  });
  Object.keys(expected).forEach((filePath) => {
    if (!(filePath in actual)) removed.push(filePath);
  });
  return { added, changed, removed };
}

export function classifyTemplateFile({
  sourceHash,
  previousHash,
  targetHash,
  targetExists = true,
  targetIsFile = true,
}) {
  if (!targetExists) return "add";
  if (!targetIsFile) return "conflict";
  if (targetHash === sourceHash) return "unchanged";
  if (previousHash && sourceHash === previousHash) return "preserved";
  if (previousHash && targetHash === previousHash) return "update";
  return "conflict";
}
