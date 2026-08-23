import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  GENERATED_CACHE_PATHS,
  cleanGeneratedCaches,
} from "./generated-cache-tools.mjs";

test("cleans only generated type caches and is idempotent", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "generated-cache-clean-"));
  try {
    fs.mkdirSync(path.join(root, ".next", "dev", "types"), { recursive: true });
    fs.writeFileSync(path.join(root, ".next", "dev", "types", "routes.d.ts"), "stale");
    fs.mkdirSync(path.join(root, "out", "types"), { recursive: true });
    fs.writeFileSync(path.join(root, "out", "types", "routes.d.ts"), "stale");
    fs.writeFileSync(path.join(root, "out", "index.html"), "keep");
    fs.writeFileSync(path.join(root, "tsconfig.tsbuildinfo"), "stale");

    assert.deepEqual(cleanGeneratedCaches(root), GENERATED_CACHE_PATHS);
    assert.equal(fs.existsSync(path.join(root, ".next")), false);
    assert.equal(fs.existsSync(path.join(root, "out", "types")), false);
    assert.equal(fs.existsSync(path.join(root, "tsconfig.tsbuildinfo")), false);
    assert.equal(fs.readFileSync(path.join(root, "out", "index.html"), "utf8"), "keep");
    assert.deepEqual(cleanGeneratedCaches(root), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
