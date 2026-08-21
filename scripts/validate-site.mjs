import fs from "node:fs";
import path from "node:path";
import { GAME_CATALOG_INSERTION_MARKER } from "./game-generator.mjs";

const root = process.cwd();
const file = (...segments) => path.join(root, ...segments);
const errors = [];
const warnings = [];

[
  "site/manifest.json",
  "site/cloudflare.json",
  "site/game-filters.json",
  "site/overrides/components.ts",
  "site/content/game-catalog-data.ts",
  "site/content/game-categories.ts",
  "site/content/home-page.ts",
].forEach((relativePath) => {
  if (!fs.existsSync(file(relativePath))) {
    errors.push(`Required site package file is missing: ${relativePath}`);
  }
});

function readJson(relativePath) {
  try {
    return JSON.parse(fs.readFileSync(file(relativePath), "utf8"));
  } catch (error) {
    errors.push(`${relativePath}: ${error.message}`);
    return null;
  }
}

function readText(relativePath) {
  try {
    return fs.readFileSync(file(relativePath), "utf8");
  } catch (error) {
    errors.push(`${relativePath}: ${error.message}`);
    return "";
  }
}

function requireString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    errors.push(`${label} must be a non-empty string.`);
    return "";
  }
  return value.trim();
}

function findQuotedValues(source) {
  return Array.from(source.matchAll(/["']([^"']+)["']/g), (match) => match[1]);
}

function extractArray(source, property) {
  const expression = new RegExp(`${property}\\s*:\\s*\\[([\\s\\S]*?)\\]`);
  return findQuotedValues(source.match(expression)?.[1] || "");
}

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  values.forEach((value) => {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  });
  return [...duplicates];
}

const manifest = readJson("site/manifest.json");
const cloudflare = readJson("site/cloudflare.json");
const ratings = readJson("site/generated/ratings.generated.json") || {};
const remoteConfig = readJson("site/generated/site.generated.json");
const catalogSource = readText("site/content/game-catalog-data.ts");
const categorySource = readText("site/content/game-categories.ts");
const homeSource = readText("site/content/home-page.ts");

if (!catalogSource.includes(GAME_CATALOG_INSERTION_MARKER)) {
  errors.push("Game catalog is missing the game:add insertion marker.");
}

if (!manifest) process.exit(1);

if (manifest.manifestVersion !== 1) {
  errors.push("manifestVersion must be 1.");
}

const site = manifest.site || {};
const routes = manifest.routes || {};
const features = manifest.features || {};
const theme = manifest.theme || {};

if (cloudflare) {
  if (cloudflare.schemaVersion !== 1) errors.push("site/cloudflare.json must use schemaVersion 1.");
  if (cloudflare.productionUrl !== site.url) {
    errors.push("site/cloudflare.json productionUrl must match site.url.");
  }
  const backendSource = readText("site/backend.ts");
  const backendBinding = backendSource.match(/databaseBinding:\s*["']([^"']+)["']/)?.[1];
  if (cloudflare.database?.binding !== backendBinding) {
    errors.push("site/cloudflare.json D1 binding must match site/backend.ts.");
  }
  if (cloudflare.database?.migrationStrategy !== undefined) {
    errors.push("site/cloudflare.json database.migrationStrategy is obsolete; every site must use a fresh Wrangler-managed D1 database.");
  }
  const d1Location = String(cloudflare.database?.location || "");
  if (d1Location && !["weur", "eeur", "apac", "oc", "wnam", "enam"].includes(d1Location)) {
    errors.push("site/cloudflare.json database.location is invalid.");
  }
}

const siteId = requireString(site.id, "site.id");
if (siteId && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(siteId)) {
  errors.push("site.id must use lowercase letters, numbers and single hyphens only.");
}

[
  "name",
  "brandName",
  "domain",
  "url",
  "language",
  "locale",
  "email",
  "timeZone",
  "primaryCategoryId",
  "primaryGameId",
  "legalLastUpdated",
].forEach((key) => requireString(site[key], `site.${key}`));

if (typeof site.email === "string" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(site.email)) {
  errors.push("site.email is not a valid email address.");
}

try {
  const siteUrl = new URL(site.url);
  if (siteUrl.protocol !== "https:") errors.push("site.url must use HTTPS.");
  if (siteUrl.hostname !== site.domain) {
    errors.push(`site.domain (${site.domain}) must match site.url hostname (${siteUrl.hostname}).`);
  }
} catch {
  errors.push("site.url must be a valid absolute URL.");
}

try {
  new Intl.DateTimeFormat("en-US", { timeZone: site.timeZone }).format();
} catch {
  errors.push(`site.timeZone is not a valid IANA time zone: ${site.timeZone}`);
}

const routeEntries = Object.entries(routes);
if (routes.home !== "/") errors.push('routes.home must be "/".');
routeEntries.forEach(([key, value]) => {
  if (typeof value !== "string" || !/^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*)?$/.test(value)) {
    errors.push(`routes.${key} must be "/" or one lowercase path segment.`);
  }
});
duplicateValues(routeEntries.map(([, value]) => value)).forEach((value) => {
  errors.push(`Public route is used more than once: ${value}`);
});

const routeKeys = new Set(routeEntries.map(([key]) => key));
if (!Array.isArray(site.navigation?.links)) {
  errors.push("site.navigation.links must be an array.");
} else {
  site.navigation.links.forEach((link, index) => {
    requireString(link?.label, `site.navigation.links[${index}].label`);
    if (!routeKeys.has(link?.route)) {
      errors.push(`site.navigation.links[${index}].route references unknown route: ${link?.route}`);
    }
  });
}

Object.entries(features).forEach(([key, value]) => {
  if (typeof value !== "boolean") errors.push(`features.${key} must be boolean.`);
});

if (!['light', 'dark'].includes(theme.defaultMode)) {
  errors.push('theme.defaultMode must be "light" or "dark".');
}
Object.entries(theme.layout || {}).forEach(([key, value]) => {
  requireString(value, `theme.layout.${key}`);
});
Object.entries(theme.colors || {}).forEach(([key, value]) => {
  if (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value)) {
    errors.push(`theme.colors.${key} must be a six-digit hex color.`);
  }
});

const assetEntries = Object.entries(site.assets || {});
assetEntries.forEach(([key, value]) => {
  requireString(value, `site.assets.${key}`);
  if (key === "gameOrigin") {
    try {
      new URL(value);
    } catch {
      errors.push("site.assets.gameOrigin must be an absolute URL.");
    }
  } else if (typeof value === "string" && value.startsWith("/")) {
    const localAsset = file("public", value.replace(/^\/+/, ""));
    if (!fs.existsSync(localAsset)) errors.push(`Local asset does not exist: public${value}`);
  }
});

const gameIds = Array.from(
  catalogSource.matchAll(/^\s{2}["']([a-z0-9][a-z0-9-]{0,63})["']\s*:\s*\{/gim),
  (match) => match[1].toLowerCase(),
);
const uniqueGameIds = new Set(gameIds);
if (gameIds.length === 0) errors.push("No games were found in site/content/game-catalog-data.ts.");
duplicateValues(gameIds).forEach((id) => errors.push(`Duplicate game ID: ${id}`));

const categoryIds = Array.from(
  categorySource.matchAll(/^\s{2}["']([a-z0-9][a-z0-9-]{0,63})["']\s*:\s*\{/gim),
  (match) => match[1].toLowerCase(),
);
const uniqueCategoryIds = new Set(categoryIds);
if (categoryIds.length === 0) errors.push("No categories were found in site/content/game-categories.ts.");
duplicateValues(categoryIds).forEach((id) => errors.push(`Duplicate category ID: ${id}`));

const referencedCategoryIds = Array.from(
  catalogSource.matchAll(/categoryId\s*:\s*["']([^"']+)["']/g),
  (match) => match[1].toLowerCase(),
);
referencedCategoryIds.forEach((categoryId) => {
  if (!uniqueCategoryIds.has(categoryId)) {
    errors.push(`Game catalog references unknown category ID: ${categoryId}`);
  }
});

if (!uniqueGameIds.has(String(site.primaryGameId || "").toLowerCase())) {
  errors.push(`site.primaryGameId does not exist in the game catalog: ${site.primaryGameId}`);
}
if (!uniqueCategoryIds.has(String(site.primaryCategoryId || "").toLowerCase())) {
  errors.push(`site.primaryCategoryId does not exist in game categories: ${site.primaryCategoryId}`);
}

const referencedGameLists = [
  ["site.footer.gameIds", site.footer?.gameIds || []],
  ["HOME_PAGE.player.relatedGameIds", extractArray(homeSource, "relatedGameIds")],
];
referencedGameLists.forEach(([label, ids]) => {
  if (!Array.isArray(ids)) {
    errors.push(`${label} must be an array.`);
    return;
  }
  duplicateValues(ids).forEach((id) => errors.push(`${label} contains duplicate game ID: ${id}`));
  ids.forEach((id) => {
    if (!uniqueGameIds.has(String(id).toLowerCase())) {
      errors.push(`${label} references unknown game ID: ${id}`);
    }
  });
});

Object.entries(ratings).forEach(([gameId, value]) => {
  if (!uniqueGameIds.has(gameId)) warnings.push(`Rating snapshot contains unknown game ID: ${gameId}`);
  if (
    !value ||
    typeof value.score !== "number" ||
    value.score < 0 ||
    value.score > 5 ||
    !Number.isInteger(value.votes) ||
    value.votes < 0
  ) {
    errors.push(`Invalid rating snapshot entry: ${gameId}`);
  }
});

if (!remoteConfig || typeof remoteConfig !== "object" || Array.isArray(remoteConfig)) {
  errors.push("site/generated/site.generated.json must contain an object.");
}

warnings.forEach((message) => console.warn(`WARN  ${message}`));
if (errors.length > 0) {
  errors.forEach((message) => console.error(`ERROR ${message}`));
  console.error(`Site validation failed with ${errors.length} error(s).`);
  process.exit(1);
}

console.log(
  `Site validation passed: ${gameIds.length} games, ${categoryIds.length} categories, ${routeEntries.length} routes.`,
);
