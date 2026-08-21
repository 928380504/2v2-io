import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildFunctionsMigrationAudit,
  copyFunctionMigration,
  rollbackFunctionMigration,
} from "./functions-migration-tools.mjs";

function fixture({ ready = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "functions-migration-"));
  const templateRoot = path.join(root, "template-source");
  const targetRoot = path.join(root, "target");
  fs.mkdirSync(path.join(templateRoot, "functions", "api"), { recursive: true });
  fs.mkdirSync(path.join(targetRoot, "functions", "api"), { recursive: true });
  fs.writeFileSync(path.join(templateRoot, "functions", "api", "route.ts"), "export { onRequestGet } from '../../../backend/route';\n");
  fs.writeFileSync(path.join(targetRoot, "functions", "api", "route.ts"), "const SQL = 'SELECT 1';\n");
  fs.writeFileSync(path.join(targetRoot, "functions", "custom.ts"), "export {};\n");
  if (ready) {
    for (const relativePath of [
      "backend/runtime.ts",
      "backend/migrations.json",
      "site/backend.ts",
      "scripts/validate-backend.mjs",
      "template/template.json",
    ]) {
      const absolutePath = path.join(targetRoot, relativePath);
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      fs.writeFileSync(absolutePath, relativePath.endsWith(".json") ? "{}\n" : "export {};\n");
    }
  }
  return { root, templateRoot, targetRoot };
}

test("blocks migration until site adoption and core update exist", () => {
  const values = fixture({ ready: false });
  const audit = buildFunctionsMigrationAudit(values);
  assert.equal(audit.status, "blocked");
  assert.equal(audit.missingPrerequisites.length, 5);
  fs.rmSync(values.root, { recursive: true, force: true });
});

test("reports replacements while preserving target-only routes", () => {
  const values = fixture();
  const audit = buildFunctionsMigrationAudit(values);
  assert.equal(audit.status, "ready");
  assert.deepEqual(audit.updates, ["api/route.ts"]);
  assert.deepEqual(audit.extras, ["custom.ts"]);
  assert.deepEqual(audit.routes, ["/api/route"]);
  fs.rmSync(values.root, { recursive: true, force: true });
});

test("restores replaced files after a failed validation", () => {
  const values = fixture();
  const backupRoot = path.join(values.targetRoot, "backups", "test");
  copyFunctionMigration({
    ...values,
    additions: [],
    updates: ["api/route.ts"],
    backupRoot,
  });
  assert.match(
    fs.readFileSync(path.join(values.targetRoot, "functions", "api", "route.ts"), "utf8"),
    /backend\/route/,
  );
  rollbackFunctionMigration({
    targetRoot: values.targetRoot,
    additions: [],
    updates: ["api/route.ts"],
    backupRoot,
  });
  assert.match(
    fs.readFileSync(path.join(values.targetRoot, "functions", "api", "route.ts"), "utf8"),
    /SELECT 1/,
  );
  fs.rmSync(values.root, { recursive: true, force: true });
});
