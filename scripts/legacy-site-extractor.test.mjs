import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { evaluateLegacyLiteral, extractLegacySite } from "./legacy-site-extractor-tools.mjs";

const templateRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function write(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value);
}

function fixture({ packageName = "stimulation-clicker", categories = 1 } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "legacy-extractor-"));
  write(path.join(root, "package.json"), JSON.stringify({ name: packageName }));
  write(path.join(root, "next-sitemap.config.js"), "export default { siteUrl: 'https://demo-game.test' };\n");
  write(path.join(root, "app", "layout.tsx"), `
    export const metadata = {
      title: 'Demo Game - Play Online', description: 'Play this demo browser game online for free.',
      applicationName: 'Demo Game', keywords: ['demo game'],
      openGraph: { images: [{ url: '/demo-logo.webp' }] },
      icons: { icon: '/favicon.ico' }, twitter: { creator: '@DemoGame' }
    };
  `);
  write(path.join(root, "app", "page.tsx"), `
    export default function Page() { return <><GameSection gameUrl="https://mt.demo-game.test/demo/main/index.html" /><VideoPlayer videoId="abc123" title="Demo Game Gameplay" description="Watch the demo." /></>; }
  `);
  write(path.join(root, "components", "YouXi", "IF-Cover.tsx"), `
    export function Cover() { return <><img src="/demo-bj.webp" /><img src="/demo-logo.webp" /></>; }
  `);
  const secondCategory = categories > 1
    ? ", { id: 'other-games', title: 'Other Games', path: '/other-games', description: 'Another category.', games: [] }"
    : "";
  write(path.join(root, "config", "games.ts"), `
    function getRandomPlays() { return 999999; }
    export const gameCategories = [{
      id: 'demo-games', title: 'Demo Games', path: '/demo-games', description: 'A focused collection of demo browser games.',
      games: [
        { id: 'demo-game', title: 'Demo Game', image: 'https://mt.demo-game.test/demo-games/demo-game/demo-game-logo.webp', url: '/demo-games/demo-game', plays: getRandomPlays(), rating: Number(getRandomRating('demo')), description: 'A multiplayer battle game with fast browser action.', isHot: true },
        { id: 'demo-duel', title: 'Demo Duel', image: '/demo-games/demo-duel/demo-duel-logo.webp', url: '/demo-games/demo-duel', plays: 500000, rating: 4.9, description: 'A two player 1v1 building duel for online opponents.' }
      ]
    }${secondCategory}];
  `);
  for (const id of ["demo-game", "demo-duel"]) {
    write(path.join(root, "app", "demo-games", id, "page.tsx"), `
      const gameDescription = '<section><h3>About ${id}</h3><p>This is the migrated detail description for ${id}.</p></section>';
      export default function Page() { return <><GameCover playUrl="https://mt.demo-game.test/demo-games/${id}/index.html" /><img src="/demo-games/${id}/${id}-bj.webp" /></>; }
    `);
  }
  write(path.join(root, "components", "TxT", "Faq.tsx"), `
    const faqs = [{ question: 'How do I play?', answer: 'Press Play and use your browser controls.' }, { question: 'Is it free?', answer: 'Yes, it is available in the browser.' }];
  `);
  return root;
}

test("evaluates static catalog data and skips executable metrics", () => {
  const result = evaluateLegacyLiteral(`const values = [{ plays: getRandomPlays('x'), title: 'Demo' }];`, "values");
  assert.deepEqual(result.value, [{ title: "Demo" }]);
  assert.deepEqual(result.skippedCalls, ["getRandomPlays"]);
});

test("extracts a ready blueprint without modifying the legacy source", () => {
  const targetRoot = fixture();
  const before = fs.readdirSync(targetRoot).sort();
  const { blueprint, report } = extractLegacySite({ targetRoot, templateRoot, today: "2026-08-17" });
  assert.ok(blueprint);
  assert.equal(report.status, "ready", JSON.stringify(report.issues));
  assert.equal(report.site.domain, "demo-game.test");
  assert.equal(report.site.primaryGameId, "demo-game");
  assert.equal(report.counts.games, 2);
  assert.equal(blueprint.games[0].plays, 0);
  assert.equal(blueprint.games[0].ratingCount, 0);
  assert.equal(blueprint.games[0].playUrl, "https://mt.demo-game.test/demo/main/index.html");
  assert.equal(blueprint.home.backgroundImage, "/demo-games/demo-game/demo-game-bj.webp");
  assert.match(blueprint.games[0].detailHtml, /migrated detail description/);
  assert.equal(blueprint.home.faqItems.length, 2);
  assert.equal(Object.hasOwn(blueprint.hotGames, "limit"), false);
  for (const group of blueprint.filters.groups) {
    assert.ok(Object.hasOwn(blueprint.games[1], group.attributeKey));
  }
  assert.deepEqual(fs.readdirSync(targetRoot).sort(), before);
  fs.rmSync(targetRoot, { recursive: true, force: true });
});

test("blocks unsupported templates and multiple categories", () => {
  const targetRoot = fixture({ packageName: "another-template", categories: 2 });
  const result = extractLegacySite({ targetRoot, templateRoot, today: "2026-08-17" });
  assert.equal(result.report.status, "blocked");
  assert.ok(result.report.issues.some((issue) => issue.code === "unsupported_template"));
  assert.ok(result.report.issues.some((issue) => issue.code === "unsupported_category_count"));
  fs.rmSync(targetRoot, { recursive: true, force: true });
});

test("synthesizes a homepage game when the legacy catalog omits it", () => {
  const targetRoot = fixture();
  const catalogPath = path.join(targetRoot, "config", "games.ts");
  fs.writeFileSync(
    catalogPath,
    fs.readFileSync(catalogPath, "utf8")
      .replace("id: 'demo-game', title: 'Demo Game'", "id: 'catalog-game', title: 'Catalog Game'")
      .replace("url: '/demo-games/demo-game'", "url: '/demo-games/catalog-game'"),
  );
  fs.writeFileSync(
    path.join(targetRoot, "app", "page.tsx"),
    `export default function Page() { return <GameSection gameUrl="https://mt.demo-game.test/demo-games/home-exclusive/index.html" />; }`,
  );
  const { blueprint, report } = extractLegacySite({ targetRoot, templateRoot, today: "2026-08-17" });
  assert.equal(blueprint.site.primaryGameId, "demo-game");
  assert.equal(blueprint.games[0].id, "demo-game");
  assert.equal(blueprint.games[0].playUrl, "https://mt.demo-game.test/demo-games/home-exclusive/index.html");
  assert.equal(blueprint.games[0].coverImage, "/demo-bj.webp");
  assert.ok(report.issues.some((issue) => issue.code === "homepage_game_synthesized"));
  fs.rmSync(targetRoot, { recursive: true, force: true });
});
