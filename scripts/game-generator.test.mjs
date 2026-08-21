import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  GAME_CATALOG_INSERTION_MARKER,
  applyCatalogChange,
  buildGameDefinition,
  insertGameDefinition,
  normalizeJsonKeys,
  normalizeGameOptions
} from "./game-generator.mjs";

const rawGame = {
  id: "space-arena",
  title: "Space Arena",
  description:
    "A fast browser shooter where players compete in compact arenas using precise movement and tactical weapons."
};

const filterConfig = {
  schemaVersion: 1,
  primaryMatchGroup: "gameplay",
  aliases: {},
  groups: [
    {
      key: "players",
      attributeKey: "playerModes",
      generatorKey: "player-modes",
      multiple: true,
      generatorDefaultValues: ["single-player"],
      options: [{ slug: "single-player", label: "Single Player" }]
    },
    {
      key: "controls",
      attributeKey: "controls",
      generatorKey: "controls",
      multiple: true,
      generatorDefaultValues: ["keyboard-mouse"],
      options: [{ slug: "keyboard-mouse", label: "Keyboard & Mouse" }]
    },
    {
      key: "loading",
      attributeKey: "loadSpeed",
      generatorKey: "load-speed",
      multiple: false,
      generatorDefaultValues: ["normal-loading"],
      options: [{ slug: "normal-loading", label: "Normal" }]
    },
    {
      key: "gameplay",
      attributeKey: "gameplay",
      generatorKey: "gameplay",
      multiple: true,
      generatorDefaultValues: ["pvp"],
      options: [{ slug: "pvp", label: "PvP" }]
    }
  ]
};

const defaults = {
  primaryCategoryId: "shooting-games",
  filterConfig
};

test("normalizes safe defaults for a new game", () => {
  const game = normalizeGameOptions(rawGame, {
    ...defaults,
    today: "2026-08-16"
  });
  assert.equal(game.categoryId, "shooting-games");
  assert.equal(game.siteAddedAt, "2026-08-16");
  assert.deepEqual(
    game.attributeEntries.find((entry) => entry.attributeKey === "gameplay")?.values,
    ["pvp"]
  );
  assert.equal(game.image, "shooting-games/space-arena/space-arena-logo.webp");
});

test("builds a typed catalog definition with asset-origin helpers", () => {
  const source = buildGameDefinition(
    normalizeGameOptions(rawGame, defaults)
  );
  assert.match(source, /"space-arena": \{/);
  assert.match(source, /image: gameAssetUrl\("shooting-games\/space-arena\/space-arena-logo.webp"\)/);
  assert.match(source, /plays: 0/);
  assert.doesNotMatch(source, /rating:/);
});

test("inserts exactly once at the explicit catalog marker", () => {
  const catalog = `export const GAME_DEFINITIONS = {\n${GAME_CATALOG_INSERTION_MARKER}\n};\n`;
  const definition = '  "space-arena": {\n  },';
  const next = insertGameDefinition(catalog, "space-arena", definition);
  assert.ok(next.indexOf(definition) < next.indexOf(GAME_CATALOG_INSERTION_MARKER));
  assert.throws(
    () => insertGameDefinition(next, "space-arena", definition),
    /already exists/
  );
});

test("rejects invalid attribute IDs and short descriptions", () => {
  assert.throws(
    () => normalizeGameOptions({ ...rawGame, controls: "telepathy" }, {
      ...defaults
    }),
    /unsupported value/
  );
  assert.throws(
    () => normalizeGameOptions({ ...rawGame, description: "Too short" }, {
      ...defaults
    }),
    /at least 40 characters/
  );
});

test("supports a non-shooter taxonomy without generator changes", () => {
  const puzzleConfig = {
    schemaVersion: 1,
    primaryMatchGroup: "difficulty",
    aliases: {},
    groups: [{
      key: "difficulty",
      attributeKey: "difficulty",
      generatorKey: "difficulty",
      multiple: false,
      generatorDefaultValues: ["easy"],
      options: [
        { slug: "easy", label: "Easy" },
        { slug: "hard", label: "Hard" }
      ]
    }]
  };
  const game = normalizeGameOptions(
    { ...rawGame, difficulty: "hard" },
    { primaryCategoryId: "puzzle-games", filterConfig: puzzleConfig }
  );
  const source = buildGameDefinition(game);
  assert.match(source, /difficulty: "hard"/);
  assert.deepEqual(game.tags, ["Hard"]);
});

test("accepts friendly camelCase keys from batch JSON", () => {
  const normalized = normalizeJsonKeys({
    ...rawGame,
    categoryId: "shooting-games",
    playUrl: "games/space-arena/index.html",
    playerModes: "single-player,multiplayer"
  });
  assert.equal(normalized.category, "shooting-games");
  assert.equal(normalized["play-url"], "games/space-arena/index.html");
  assert.equal(normalized["player-modes"], "single-player,multiplayer");
});

test("backs up successful writes and restores failed writes", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "game-generator-"));
  const catalogPath = path.join(directory, "catalog.ts");
  const successBackup = path.join(directory, "success", "catalog.ts");
  const failureBackup = path.join(directory, "failure", "catalog.ts");
  fs.writeFileSync(catalogPath, "original", "utf8");

  applyCatalogChange({
    catalogPath,
    backupPath: successBackup,
    nextCatalog: "valid update",
    validate() {}
  });
  assert.equal(fs.readFileSync(catalogPath, "utf8"), "valid update");
  assert.equal(fs.readFileSync(successBackup, "utf8"), "original");

  assert.throws(() => applyCatalogChange({
    catalogPath,
    backupPath: failureBackup,
    nextCatalog: "invalid update",
    validate() {
      throw new Error("validation failed");
    }
  }), /validation failed/);
  assert.equal(fs.readFileSync(catalogPath, "utf8"), "valid update");
  fs.rmSync(directory, { recursive: true, force: true });
});
