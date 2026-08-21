import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildCloudflareAudit,
  buildPagesDeployArguments,
  normalizeCloudflareConfig,
  persistProvisionedDatabaseId,
  prepareCloudflareProvisionWorkspace,
  prepareCloudflareWorkspace,
  readProvisionedDatabaseId,
  runHealthChecks,
} from "./cloudflare-deployment-tools.mjs";

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cloudflare-deploy-"));
  for (const directory of ["site", "migrations", "out"]) {
    fs.mkdirSync(path.join(root, directory), { recursive: true });
  }
  for (const file of ["manifest.json", "backend.ts", "competition-migrations.json"]) {
    fs.copyFileSync(path.join(sourceRoot, "site", file), path.join(root, "site", file));
  }
  const config = JSON.parse(fs.readFileSync(path.join(sourceRoot, "site", "cloudflare.json"), "utf8"));
  config.database.id = "fde6f42a-2517-4cfa-a6fe-4335a0896971";
  fs.writeFileSync(path.join(root, "site", "cloudflare.json"), `${JSON.stringify(config, null, 2)}\n`);
  for (const migration of fs.readdirSync(path.join(sourceRoot, "migrations"))) {
    if (migration.endsWith(".sql")) {
      fs.copyFileSync(path.join(sourceRoot, "migrations", migration), path.join(root, "migrations", migration));
    }
  }
  fs.writeFileSync(path.join(root, "out", "index.html"), "<!doctype html><title>ok</title>");
  fs.writeFileSync(path.join(root, "out", "_worker.js"), "export default {};");
  fs.writeFileSync(path.join(root, "out", "_routes.json"), JSON.stringify({ include: ["/api/health"] }));
  return root;
}

test("normalizes a deployment config without storing credentials", () => {
  const source = JSON.parse(fs.readFileSync(path.join(sourceRoot, "site", "cloudflare.json"), "utf8"));
  const value = normalizeCloudflareConfig(source);
  assert.equal(value.database.binding, "DB");
  assert.equal(value.productionUrl, source.productionUrl);
  assert.equal(value.database.location, "enam");
  assert.equal("apiToken" in value, false);
  assert.equal("migrationStrategy" in value.database, false);
});

test("rejects the obsolete existing-database strategy", () => {
  const config = JSON.parse(fs.readFileSync(path.join(sourceRoot, "site", "cloudflare.json"), "utf8"));
  config.database.migrationStrategy = "manual-existing";
  assert.throws(
    () => normalizeCloudflareConfig(config),
    /fresh D1 database managed by Wrangler/,
  );
});

test("audits binding, build artifacts and selected migration groups", () => {
  const root = fixture();
  try {
    const audit = buildCloudflareAudit(root);
    assert.equal(audit.blockers.length, 0);
    assert.equal(typeof audit.migrationPlan.adapter, "string");
    assert.ok(audit.migrationPlan.adapter.length > 0);
    assert.ok(audit.migrationPlan.migrations.length > 0);
    assert.equal(audit.artifacts.worker, true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("stages only selected immutable migrations in an ignored workspace", () => {
  const root = fixture();
  try {
    const audit = buildCloudflareAudit(root);
    const prepared = prepareCloudflareWorkspace(root, audit);
    const staged = fs.readdirSync(prepared.migrationsDirectory).sort();
    assert.deepEqual(staged, audit.migrationPlan.migrations.map((item) => item.name));
    const config = JSON.parse(fs.readFileSync(prepared.wranglerPath, "utf8"));
    assert.equal(config.d1_databases[0].database_id, audit.config.database.id);
    assert.equal(config.d1_databases[0].migrations_dir, "migrations");
    assert.equal(config.pages_build_output_dir, "../../../out");
    const plan = JSON.parse(fs.readFileSync(prepared.planPath, "utf8"));
    assert.equal("migrationStrategy" in plan.database, false);
    assert.deepEqual(
      buildPagesDeployArguments(audit, prepared.workspace),
      ["pages", "deploy", "--project-name", audit.config.pagesProject, "--branch", audit.config.productionBranch, "--cwd", prepared.workspace],
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("prepares a credential-free provisioning config before a database exists", () => {
  const root = fixture();
  try {
    const configPath = path.join(root, "site", "cloudflare.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    config.database.id = "";
    fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
    const audit = buildCloudflareAudit(root);
    const prepared = prepareCloudflareProvisionWorkspace(root, audit);
    const wranglerConfig = JSON.parse(fs.readFileSync(prepared.wranglerPath, "utf8"));
    assert.equal(wranglerConfig.name, audit.config.pagesProject);
    assert.equal(wranglerConfig.pages_build_output_dir, "../../../out");
    assert.equal("d1_databases" in wranglerConfig, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("records a newly provisioned UUID with a recoverable backup", () => {
  const root = fixture();
  try {
    const configPath = path.join(root, "site", "cloudflare.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    config.database.id = "";
    fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
    const audit = buildCloudflareAudit(root);
    const prepared = prepareCloudflareProvisionWorkspace(root, audit);
    const databaseId = "fde6f42a-2517-4cfa-a6fe-4335a0896971";
    const wranglerConfig = JSON.parse(fs.readFileSync(prepared.wranglerPath, "utf8"));
    wranglerConfig.d1_databases = [{
      binding: audit.config.database.binding,
      database_name: audit.config.database.name,
      database_id: databaseId,
    }];
    fs.writeFileSync(prepared.wranglerPath, `${JSON.stringify(wranglerConfig, null, 2)}\n`);
    assert.equal(readProvisionedDatabaseId(prepared.wranglerPath, audit.config.database), databaseId);
    const result = persistProvisionedDatabaseId(root, audit, databaseId, {
      now: new Date("2026-08-17T01:02:03.000Z"),
    });
    assert.equal(JSON.parse(fs.readFileSync(configPath, "utf8")).database.id, databaseId);
    assert.equal(JSON.parse(fs.readFileSync(result.backupPath, "utf8")).database.id, "");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("health checks verify HTML and JSON ok contracts without writes", async () => {
  const config = normalizeCloudflareConfig(JSON.parse(fs.readFileSync(path.join(sourceRoot, "site", "cloudflare.json"), "utf8")));
  const calls = [];
  const report = await runHealthChecks({
    config,
    primaryGameId: "1v1-lol",
    fetchImpl: async (url) => {
      calls.push(url);
      if (url.endsWith("/")) return new Response("<!doctype html>", { status: 200 });
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
  });
  assert.equal(report.ok, true);
  assert.equal(calls.length, config.health.checks.length);
  assert.ok(calls.some((url) => url.includes("gameIds=1v1-lol")));
});
