import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  fleetTotals,
  normalizeFleetConfiguration,
  parseSyncOutput,
} from "./template-fleet-tools.mjs";
import { classifyTemplateFile, hashFile } from "./template-tools.mjs";

test("template hashes ignore CRLF differences in text files", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "template-hash-text-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const lfPath = path.join(directory, "lf.ts");
  const crlfPath = path.join(directory, "crlf.ts");
  fs.writeFileSync(lfPath, "export const value = 1;\n");
  fs.writeFileSync(crlfPath, "export const value = 1;\r\n");
  assert.equal(hashFile(lfPath), hashFile(crlfPath));
});

test("template hashes preserve raw bytes for binary files", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "template-hash-binary-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const firstPath = path.join(directory, "first.bin");
  const secondPath = path.join(directory, "second.bin");
  fs.writeFileSync(firstPath, Buffer.from([0, 13, 10, 255]));
  fs.writeFileSync(secondPath, Buffer.from([0, 10, 255]));
  assert.notEqual(hashFile(firstPath), hashFile(secondPath));
});

test("preserves a local-only edit when the template file did not change", () => {
  assert.equal(
    classifyTemplateFile({
      sourceHash: "same-template",
      previousHash: "same-template",
      targetHash: "local-edit",
    }),
    "preserved",
  );
});

test("updates a clean target and conflicts only on concurrent edits", () => {
  assert.equal(
    classifyTemplateFile({
      sourceHash: "new-template",
      previousHash: "old-template",
      targetHash: "old-template",
    }),
    "update",
  );
  assert.equal(
    classifyTemplateFile({
      sourceHash: "new-template",
      previousHash: "old-template",
      targetHash: "local-edit",
    }),
    "conflict",
  );
});

test("normalizes fleet paths relative to the registry", () => {
  const configPath = path.join("H:\\templates", "template", "sites.json");
  const sites = normalizeFleetConfiguration(
    {
      schemaVersion: 1,
      sites: [{ id: "temple-run", path: "../../sites/temple-run" }],
    },
    configPath,
  );
  assert.equal(sites[0].id, "temple-run");
  assert.equal(sites[0].enabled, true);
  assert.match(sites[0].path.replaceAll("\\", "/"), /sites\/temple-run$/);
});

test("rejects duplicate IDs and paths", () => {
  assert.throws(
    () => normalizeFleetConfiguration(
      {
        schemaVersion: 1,
        sites: [
          { id: "same", path: "one" },
          { id: "same", path: "two" },
        ],
      },
      "template/sites.json",
    ),
    /Duplicate fleet site ID/,
  );
});

test("summarizes a single-site preview", () => {
  const result = parseSyncOutput(`
Template update 2.3.0 -> 2.5.0
Add: 4
Update: 8
Remove: 2
Local conflicts: 1
Preserved local: 5
Unchanged: 130
`, { success: true });
  assert.equal(result.status, "conflict");
  assert.equal(result.fromVersion, "2.3.0");
  assert.deepEqual(result.changes, {
    add: 4,
    update: 8,
    remove: 2,
    conflicts: 1,
    preserved: 5,
    unchanged: 130,
  });
});

test("aggregates independent site results", () => {
  const totals = fleetTotals([
    { status: "ready", changes: { add: 2, update: 3, remove: 0, conflicts: 0, preserved: 4 } },
    { status: "conflict", changes: { add: 1, update: 0, remove: 1, conflicts: 2, preserved: 5 } },
  ]);
  assert.equal(totals.ready, 1);
  assert.equal(totals.conflict, 1);
  assert.equal(totals.add, 3);
  assert.equal(totals.conflicts, 2);
  assert.equal(totals.preserved, 9);
});
