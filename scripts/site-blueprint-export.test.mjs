import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildSiteCreationPlan } from "./site-creator-tools.mjs";
import {
  applyBlueprintExportPlan,
  buildBlueprintExportPlan,
  evaluateTypeScriptLiteral,
  exportCurrentSiteBlueprint,
} from "./site-blueprint-export-tools.mjs";

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("evaluates site-owned TypeScript literals without executing modules", () => {
  const value = evaluateTypeScriptLiteral(`
    const SITE_CONFIG = external;
    const base = { label: "Game", count: 2 } as const;
    export const VALUE = {
      ...base,
      asset: gameAssetUrl("games/demo.webp"),
      title: \`${'${SITE_CONFIG.name}'} ${'${base.label}'}\`,
      ids: new Set<string>(["a", "b"]),
    } satisfies Record<string, unknown>;
  `, "VALUE", { external: { name: "Demo" } });
  assert.deepEqual(value, {
    label: "Game",
    count: 2,
    asset: "games/demo.webp",
    title: "Demo Game",
    ids: ["a", "b"],
  });
});

test("exports the current site package into one validated editable blueprint", () => {
  const blueprint = exportCurrentSiteBlueprint(sourceRoot);
  const checkedIn = JSON.parse(fs.readFileSync(path.join(sourceRoot, "site", "blueprint.json"), "utf8"));
  const primary = blueprint.games.find((game) => game.id === blueprint.site.primaryGameId);
  assert.equal(blueprint.site.id, checkedIn.site.id);
  assert.equal(blueprint.games.length, checkedIn.games.length);
  assert.ok(primary);
  assert.equal((primary.detailHtml || blueprint.home.descriptionHtml).length > 40, true);
  assert.equal(blueprint.category.description.length > 40, true);
  assert.equal(blueprint.legal.pages.dmca.showLastUpdated, true);
  assert.equal(blueprint.cloudflare.database.location, checkedIn.cloudflare.database.location);
  assert.equal(Object.hasOwn(blueprint.hotGames, "limit"), false);
});

test("the exported blueprint preserves rich content through site generation", () => {
  const blueprint = exportCurrentSiteBlueprint(sourceRoot);
  const plan = buildSiteCreationPlan({ root: sourceRoot, blueprint });
  const catalogSource = plan.writes.get(path.join(sourceRoot, "site", "content", "game-catalog-data.ts"));
  const generated = evaluateTypeScriptLiteral(catalogSource, "GAME_DEFINITIONS", {});
  assert.deepEqual(Object.keys(generated), blueprint.games.map((game) => game.id));
  const primaryId = blueprint.site.primaryGameId;
  const main = blueprint.games.find((game) => game.id === primaryId);
  assert.ok(main);
  assert.equal(generated[primaryId].detail.description, main.detailHtml);
  assert.equal(generated[primaryId].plays, main.plays);
  assert.equal(generated[primaryId].favorites ?? 0, main.favorites ?? 0);
  const stored = JSON.parse(plan.writes.get(path.join(sourceRoot, "site", "blueprint.json")));
  assert.deepEqual(stored, blueprint);
});

test("a generated site exports back to the identical blueprint", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "site-roundtrip-"));
  try {
    const blueprint = exportCurrentSiteBlueprint(sourceRoot);
    const plan = buildSiteCreationPlan({ root: sourceRoot, blueprint });
    for (const [sourcePath, contents] of plan.writes) {
      const relativePath = path.relative(sourceRoot, sourcePath);
      if (!relativePath.startsWith(`site${path.sep}`)) continue;
      const targetPath = path.join(root, relativePath);
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, contents);
    }
    fs.copyFileSync(path.join(sourceRoot, "site", "backend.ts"), path.join(root, "site", "backend.ts"));
    for (const packId of ["1v1-lol", "word-score"]) {
      const target = path.join(root, "competition-packs", packId, "pack.json");
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(sourceRoot, "competition-packs", packId, "pack.json"), target);
    }
    const migrationTarget = path.join(root, "competition-packs", "word-score", "migration.sql");
    fs.copyFileSync(path.join(sourceRoot, "competition-packs", "word-score", "migration.sql"), migrationTarget);
    const expectedHash = crypto.createHash("sha256").update(JSON.stringify(blueprint)).digest("hex");
    const actualHash = crypto.createHash("sha256").update(JSON.stringify(exportCurrentSiteBlueprint(root))).digest("hex");
    assert.equal(actualHash, expectedHash);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("writes the blueprint with a recoverable backup", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "site-export-"));
  try {
    const targetPath = path.join(root, "site", "blueprint.json");
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, "{\"old\":true}\n");
    const plan = {
      status: "ready",
      exists: true,
      targetPath,
      contents: "{\"schemaVersion\":1}\n",
    };
    const result = applyBlueprintExportPlan(root, plan, {
      now: new Date("2026-08-17T01:02:03.000Z"),
    });
    assert.equal(fs.readFileSync(targetPath, "utf8"), plan.contents);
    assert.equal(fs.readFileSync(result.backupPath, "utf8"), "{\"old\":true}\n");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("reports the checked-in blueprint as current after export", () => {
  const plan = buildBlueprintExportPlan(sourceRoot);
  assert.equal(plan.status, "current");
});
