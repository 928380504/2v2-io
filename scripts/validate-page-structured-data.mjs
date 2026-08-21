import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "site", "manifest.json"), "utf8"),
);

function routeOutputFile(route) {
  if (route === "/") return path.join(root, "out", "index.html");
  const relative = route.replace(/^\/+|\/+$/g, "");
  const flatFile = path.join(root, "out", `${relative}.html`);
  if (fs.existsSync(flatFile)) return flatFile;
  return path.join(root, "out", relative, "index.html");
}

function jsonLdItems(file) {
  if (!fs.existsSync(file)) throw new Error(`Missing static page: ${file}`);
  const html = fs.readFileSync(file, "utf8");
  return [...html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )].map((match) => JSON.parse(match[1]));
}

function hasType(item, type) {
  const value = item?.["@type"];
  return Array.isArray(value) ? value.includes(type) : value === type;
}

function validateGameEntity(items, expectedUrl, label) {
  const game = items.find((item) => hasType(item, "WebApplication"));
  if (!game || !hasType(game, "VideoGame")) {
    throw new Error(`${label} is missing the VideoGame + WebApplication entity.`);
  }
  if (game.url !== expectedUrl || game["@id"] !== `${expectedUrl}#game`) {
    throw new Error(`${label} game entity does not use its own page URL.`);
  }
  if (game.offers?.price !== 0) {
    throw new Error(`${label} game entity is missing its free Offer.`);
  }
  if (manifest.features.ratings) {
    const rating = game.aggregateRating;
    if (
      !rating ||
      rating["@type"] !== "AggregateRating" ||
      !Number.isFinite(rating.ratingValue) ||
      !Number.isInteger(rating.ratingCount) ||
      rating.ratingCount <= 0
    ) {
      throw new Error(`${label} is missing a valid aggregate rating.`);
    }
  }
  return game;
}

const homeUrl = new URL("/", `${manifest.site.url}/`).toString();
const detailRoute = `${manifest.routes.gameCategory}/${manifest.site.primaryGameId}`;
const detailUrl = new URL(detailRoute, `${manifest.site.url}/`).toString();
const homeItems = jsonLdItems(routeOutputFile("/"));
const detailItems = jsonLdItems(routeOutputFile(detailRoute));
const homeGame = validateGameEntity(homeItems, homeUrl, "Homepage");
validateGameEntity(detailItems, detailUrl, "Primary game detail page");

const webPage = homeItems.find((item) => hasType(item, "WebPage"));
if (!webPage || webPage.mainEntity?.["@id"] !== homeGame["@id"]) {
  throw new Error("Homepage WebPage.mainEntity is not linked to the game entity.");
}

console.log(
  `Structured data passed: ${manifest.site.primaryGameId} shares ratings across homepage and detail page.`,
);
