import fs from "node:fs";
import path from "node:path";

export const GENERATED_CACHE_PATHS = Object.freeze([
  ".next",
  "out/types",
  "tsconfig.tsbuildinfo",
]);

const retryableCodes = new Set(["EBUSY", "ENOTEMPTY", "EPERM"]);
const retrySignal = new Int32Array(new SharedArrayBuffer(4));

function removeTree(target) {
  let entry;
  try {
    entry = fs.lstatSync(target);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  if (entry.isDirectory() && !entry.isSymbolicLink()) {
    for (const child of fs.readdirSync(target)) removeTree(path.join(target, child));
    fs.rmdirSync(target);
    return;
  }
  try {
    fs.unlinkSync(target);
  } catch (error) {
    if (error?.code !== "EPERM") throw error;
    fs.chmodSync(target, 0o666);
    fs.unlinkSync(target);
  }
}

function removeTreeWithRetry(target) {
  for (let attempt = 0; attempt <= 5; attempt += 1) {
    try {
      removeTree(target);
      if (fs.existsSync(target)) throw Object.assign(new Error("path still exists"), { code: "ENOTEMPTY" });
      return;
    } catch (error) {
      if (attempt === 5 || !retryableCodes.has(error?.code)) throw error;
      Atomics.wait(retrySignal, 0, 0, 150);
    }
  }
}

export function cleanGeneratedCaches(root) {
  const removed = [];
  for (const relativePath of GENERATED_CACHE_PATHS) {
    const target = path.join(root, ...relativePath.split("/"));
    if (!fs.existsSync(target)) continue;
    try {
      // Node's recursive rm can report success without removing directories on
      // some Windows H: drive setups. Walk the tree explicitly and verify it.
      removeTreeWithRetry(target);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Unable to clear generated cache ${relativePath}. Stop any running Next.js dev/build process for this site and retry. ${detail}`,
      );
    }
    removed.push(relativePath);
  }
  return removed;
}
