import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  applyCatalogChange,
  buildGameDefinition,
  insertGameDefinition,
  normalizeJsonKeys,
  normalizeGameOptions,
  parseArguments
} from "./game-generator.mjs";

const root = process.cwd();
const catalogPath = path.join(root, "site", "content", "game-catalog-data.ts");
const categoriesPath = path.join(root, "site", "content", "game-categories.ts");
const manifestPath = path.join(root, "site", "manifest.json");
const filtersPath = path.join(root, "site", "game-filters.json");

function usage() {
  console.log(`
Add one game to the canonical site catalog. Preview is the default.

Preview:
  npm run game:add -- --id space-arena --title "Space Arena" --description "A fast browser shooter where players compete in compact arenas using precise movement and tactical weapons."

Apply with a recoverable backup:
  npm run game:add -- --id space-arena --title "Space Arena" --description "A fast browser shooter where players compete in compact arenas using precise movement and tactical weapons." --apply

Preview or apply a batch JSON file:
  npm run game:add -- --from examples/game-import.example.json
  npm run game:add -- --from examples/game-import.example.json --apply

Common options:
  --category, --image, --play-url, --cover-image, --cover-alt
  --developer, --technology, --platforms, --tags
  --site-added-at, --created-at, --hot, --match-bridge
  --youtube-id, --youtube-title, --youtube-description

Game attribute options are defined by site/game-filters.json. Use each group's
generatorKey as a command option, for example --player-modes or --gameplay.
Multiple values are comma-separated.
Relative asset paths use the site's configured game asset origin. Absolute URLs
and paths beginning with / are preserved as written.
`);
}

function categoryIds(source) {
  return new Set(
    Array.from(
      source.matchAll(/^\s{2}["']([a-z0-9][a-z0-9-]{0,63})["']\s*:\s*\{/gim),
      (match) => match[1]
    )
  );
}

const args = parseArguments(process.argv.slice(2));
if (args.help) {
  usage();
  process.exit(0);
}

try {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const filterConfig = JSON.parse(fs.readFileSync(filtersPath, "utf8"));
  const catalogSource = fs.readFileSync(catalogPath, "utf8");
  const categoriesSource = fs.readFileSync(categoriesPath, "utf8");
  const rawGames = args.from
    ? (() => {
        const importPath = path.resolve(root, String(args.from));
        const imported = JSON.parse(fs.readFileSync(importPath, "utf8"));
        const values = Array.isArray(imported) ? imported : imported.games;
        if (!Array.isArray(values) || values.length === 0) {
          throw new Error("--from must point to a JSON array or an object with a non-empty games array.");
        }
        if (values.length > 100) {
          throw new Error("A single batch cannot contain more than 100 games.");
        }
        return values.map(normalizeJsonKeys);
      })()
    : [args];
  const games = rawGames.map((rawGame) => normalizeGameOptions(rawGame, {
    primaryCategoryId: manifest.site?.primaryCategoryId,
    filterConfig
  }));
  const duplicateBatchIds = games
    .map((game) => game.id)
    .filter((id, index, values) => values.indexOf(id) !== index);
  if (duplicateBatchIds.length) {
    throw new Error(`Duplicate game ID(s) in batch: ${[...new Set(duplicateBatchIds)].join(", ")}`);
  }
  const knownCategories = categoryIds(categoriesSource);
  for (const game of games) {
    if (!knownCategories.has(game.categoryId)) {
      throw new Error(
        `Unknown category ${game.categoryId}. Available: ${[...knownCategories].join(", ")}`
      );
    }
  }
  let nextCatalog = catalogSource;
  const definitions = games.map((game) => {
    const definition = buildGameDefinition(game);
    nextCatalog = insertGameDefinition(nextCatalog, game.id, definition);
    return { game, definition };
  });

  console.log(`Games in batch: ${games.length}`);
  for (const { game, definition } of definitions) {
    console.log(`\n=== ${game.title} (${game.id}) ===`);
    console.log(`Category: ${game.categoryId}`);
    console.log(`Detail route: ${manifest.routes?.gameCategory || "/games"}/${game.id}`);
    console.log("\nProposed catalog entry:\n");
    console.log(definition);
    console.log("\nRequired game assets or URLs:");
    console.log(`- Logo: ${game.image}`);
    console.log(`- Cover: ${game.coverImage}`);
    console.log(`- Play URL: ${game.playUrl}`);
  }

  if (!args.apply) {
    console.log("\nPreview only; no files changed. Add --apply after reviewing the entry.");
    process.exit(0);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDirectory = path.join(root, "backups", "game-add", timestamp);
  const backupPath = path.join(backupDirectory, "game-catalog-data.ts");
  let validation;
  applyCatalogChange({
    catalogPath,
    backupPath,
    nextCatalog,
    validate() {
      validation = spawnSync(
        process.execPath,
        [path.join(root, "scripts", "validate-site.mjs")],
        { cwd: root, encoding: "utf8" }
      );
      if (validation.status !== 0) {
        process.stdout.write(validation.stdout || "");
        process.stderr.write(validation.stderr || "");
        throw new Error("Site validation failed; the catalog was restored from backup.");
      }
    }
  });

  process.stdout.write(validation?.stdout || "");
  console.log(`${games.length} game(s) added: ${path.relative(root, catalogPath)}`);
  console.log(`Previous catalog backed up: ${path.relative(root, backupPath)}`);
  console.log("Next: verify the three asset URLs, refine the article copy, then run npm run build.");
} catch (error) {
  usage();
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
