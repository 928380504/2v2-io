import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import {
  applySiteCreationPlan,
  buildSiteCreationPlan,
  normalizeSiteBlueprint,
} from "./site-creator-tools.mjs";

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const examplePath = path.join(sourceRoot, "examples", "site-blueprint.example.json");

function example() {
  return JSON.parse(fs.readFileSync(examplePath, "utf8"));
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "site-create-"));
  for (const adapter of ["1v1-lol", "word-score"]) {
    fs.mkdirSync(path.join(root, "competition-packs", adapter), { recursive: true });
    fs.copyFileSync(
      path.join(sourceRoot, "competition-packs", adapter, "pack.json"),
      path.join(root, "competition-packs", adapter, "pack.json"),
    );
  }
  fs.copyFileSync(
    path.join(sourceRoot, "competition-packs", "word-score", "migration.sql"),
    path.join(root, "competition-packs", "word-score", "migration.sql"),
  );
  fs.mkdirSync(path.join(root, "site", "content"), { recursive: true });
  fs.mkdirSync(path.join(root, "site", "generated"), { recursive: true });
  fs.mkdirSync(path.join(root, "backend"), { recursive: true });
  fs.mkdirSync(path.join(root, "migrations"), { recursive: true });
  fs.cpSync(path.join(sourceRoot, "site", "manifest.json"), path.join(root, "site", "manifest.json"));
  fs.cpSync(path.join(sourceRoot, "site", "backend.ts"), path.join(root, "site", "backend.ts"));
  fs.cpSync(path.join(sourceRoot, "site", "data-provider.ts"), path.join(root, "site", "data-provider.ts"));
  fs.cpSync(path.join(sourceRoot, "site", "competition-migrations.json"), path.join(root, "site", "competition-migrations.json"));
  fs.cpSync(path.join(sourceRoot, "backend", "contracts.ts"), path.join(root, "backend", "contracts.ts"));
  fs.cpSync(path.join(sourceRoot, "backend", "runtime.ts"), path.join(root, "backend", "runtime.ts"));
  for (const migration of fs.readdirSync(path.join(sourceRoot, "migrations"))) {
    if (!migration.endsWith(".sql")) continue;
    fs.copyFileSync(
      path.join(sourceRoot, "migrations", migration),
      path.join(root, "migrations", migration),
    );
  }
  fs.mkdirSync(path.join(root, "public"), { recursive: true });
  for (const asset of ["1v1-lol-logo.webp", "1v1-lol-logo.png", "favicon.ico", "1v1-lol-bj.webp"]) {
    fs.writeFileSync(path.join(root, "public", asset), Buffer.from(`fixture:${asset}`));
  }
  return root;
}

test("normalizes a complete site blueprint", () => {
  const blueprint = normalizeSiteBlueprint(example(), { root: sourceRoot, today: "2026-08-17" });
  assert.equal(blueprint.site.id, "1v1-lol");
  assert.equal(blueprint.category.id, "1v1-lol-games");
  assert.equal(blueprint.games.length, 1);
  assert.equal(blueprint.games[0].attributeEntries.length, 5);
  assert.equal(blueprint.competition.adapterId, "1v1-lol");
  assert.equal(blueprint.cloudflare.database.location, "enam");
});

test("builds a clean catalog, stable primary category contract and resource checklist", () => {
  const root = fixture();
  try {
    const plan = buildSiteCreationPlan({ root, blueprint: example() });
    const readWrite = (relativePath) => plan.writes.get(path.join(root, ...relativePath.split("/")));
    const catalog = readWrite("site/content/game-catalog-data.ts");
    const categoryPages = readWrite("site/content/category-pages.ts");
    const ranking = readWrite("site/content/popular-games.ts");
    const checklist = JSON.parse(readWrite("site/generated/resource-checklist.json"));
    const cloudflare = JSON.parse(readWrite("site/cloudflare.json"));
    assert.match(catalog, /"1v1-lol": \{/);
    assert.doesNotMatch(catalog, /1v1-lol-pro/);
    assert.match(categoryPages, /PRIMARY_CATEGORY_PAGE/);
    assert.match(ranking, /gameRankingExcludedIds/);
    assert.doesNotMatch(ranking, /sortByPopularGameOrder/);
    assert.ok(checklist.resources.some((resource) => resource.kind === "homeBackground"));
    assert.equal(checklist.resources.filter((resource) => resource.status === "missing").length, 0);
    assert.equal(cloudflare.database.location, "enam");
    assert.equal(cloudflare.database.id, "");
    for (const [filePath, source] of plan.writes) {
      if (!filePath.endsWith(".ts")) continue;
      const result = ts.transpileModule(source, {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
        reportDiagnostics: true,
      });
      const errors = (result.diagnostics || []).filter(
        (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
      );
      assert.deepEqual(errors, [], `Generated TypeScript is invalid: ${filePath}`);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("preserves fetched rating values and file order while adding missing games", () => {
  const root = fixture();
  try {
    fs.writeFileSync(
      path.join(root, "site", "generated", "ratings.generated.json"),
      JSON.stringify({ orphan: { score: 1, votes: 9 }, "1v1-lol": { score: 4.7, votes: 12 } }, null, 2) + "\n",
    );
    const blueprint = example();
    blueprint.games.push({
      ...blueprint.games[0],
      id: "second-game",
      title: "Second Game",
      playUrl: "games/second-game/index.html",
    });
    const plan = buildSiteCreationPlan({ root, blueprint });
    const snapshot = JSON.parse(plan.writes.get(path.join(root, "site", "generated", "ratings.generated.json")));
    assert.deepEqual(Object.keys(snapshot), ["1v1-lol", "second-game"]);
    assert.deepEqual(snapshot["1v1-lol"], { score: 4.7, votes: 12 });
    assert.deepEqual(snapshot["second-game"], { score: 0, votes: 0 });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("applies idempotently and rolls back every changed file after validation failure", () => {
  const root = fixture();
  try {
    const first = buildSiteCreationPlan({ root, blueprint: example() });
    applySiteCreationPlan({
      root,
      plan: first,
      backupRoot: path.join(root, "backups", "success"),
      validate() {},
    });
    const current = buildSiteCreationPlan({ root, blueprint: example() });
    assert.equal(current.status, "current");

    const changed = example();
    changed.site.name = "Changed Site Name";
    const failing = buildSiteCreationPlan({ root, blueprint: changed });
    const manifestPath = path.join(root, "site", "manifest.json");
    const before = fs.readFileSync(manifestPath, "utf8");
    assert.throws(
      () => applySiteCreationPlan({
        root,
        plan: failing,
        backupRoot: path.join(root, "backups", "failure"),
        validate() { throw new Error("synthetic validation failure"); },
      }),
      /synthetic validation failure/,
    );
    assert.equal(fs.readFileSync(manifestPath, "utf8"), before);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("installs or preserves a packaged competition migration without executing it", () => {
  const root = fixture();
  try {
    const blueprint = example();
    blueprint.competition.adapterId = "word-score";
    const plan = buildSiteCreationPlan({ root, blueprint });
    const migration = plan.additions.find((file) => /migrations\/\d+_word_score\.sql$/.test(file));
    const manifestPath = path.join(root, "site", "competition-migrations.json");
    const manifest = JSON.parse(
      plan.writes.get(manifestPath) ?? fs.readFileSync(manifestPath, "utf8"),
    );
    assert.ok(
      Array.isArray(manifest.groups["word-score"]) && manifest.groups["word-score"].length > 0,
      "word-score migration group should be installed or preserved",
    );
    if (migration) {
      assert.ok(manifest.groups["word-score"].includes(migration));
    } else {
      assert.ok(
        manifest.groups["word-score"].some((file) => /migrations\/\d+_word_score\.sql$/.test(file)),
        "an existing word-score migration should remain registered",
      );
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
