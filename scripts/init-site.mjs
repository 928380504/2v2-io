import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const manifestPath = path.join(root, "site", "manifest.json");

function parseArguments(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 1) {
    const token = values[index];
    if (!token.startsWith("--")) continue;
    const [rawKey, inlineValue] = token.slice(2).split(/=(.*)/s, 2);
    if (inlineValue !== undefined) {
      result[rawKey] = inlineValue;
    } else if (values[index + 1] && !values[index + 1].startsWith("--")) {
      result[rawKey] = values[index + 1];
      index += 1;
    } else {
      result[rawKey] = true;
    }
  }
  return result;
}

function usage() {
  console.log(`
Create the global configuration for a new site in a fresh template copy.

Preview only:
  npm run site:init -- --id temple-run --name "Temple Run" --domain temple-run.example --email owner@example.com --primary-game temple-run

Write manifest and create a recoverable backup:
  npm run site:init -- --id temple-run --name "Temple Run" --domain temple-run.example --email owner@example.com --primary-game temple-run --apply

Optional:
  --brand, --time-zone, --primary-category, --category-path,
  --filter-path, --filter-label, --game-origin
`);
}

function slug(value, label) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
    throw new Error(`${label} must use lowercase letters, numbers and single hyphens only.`);
  }
  return normalized;
}

function domain(value) {
  const normalized = String(value || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/$/, "");
  if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/i.test(normalized)) {
    throw new Error("--domain must be a valid hostname without a path.");
  }
  return normalized.toLowerCase();
}

function route(value, fallback, label) {
  const normalized = String(value || fallback).trim().replace(/^\/+|\/+$/g, "");
  return `/${slug(normalized, label)}`;
}

function titleFromSlug(value) {
  return value
    .replace(/^\/+|\/+$/g, "")
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const args = parseArguments(process.argv.slice(2));
if (args.help) {
  usage();
  process.exit(0);
}

const required = ["id", "name", "domain", "email", "primary-game"];
const missing = required.filter((key) => !args[key]);
if (missing.length > 0) {
  usage();
  console.error(`Missing required option(s): ${missing.map((key) => `--${key}`).join(", ")}`);
  process.exit(1);
}

try {
  const current = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const siteId = slug(args.id, "--id");
  const siteName = String(args.name).trim();
  const siteDomain = domain(args.domain);
  const primaryGameId = slug(args["primary-game"], "--primary-game");
  const primaryCategoryId = slug(
    args["primary-category"] || `${siteId}-games`,
    "--primary-category",
  );
  const categoryPath = route(
    args["category-path"],
    primaryCategoryId,
    "--category-path",
  );
  const filterPath = route(
    args["filter-path"],
    "games",
    "--filter-path",
  );
  const siteUrl = `https://${siteDomain}`;

  const next = structuredClone(current);
  next.site = {
    ...next.site,
    id: siteId,
    name: siteName,
    brandName: String(args.brand || siteDomain).trim(),
    domain: siteDomain,
    url: siteUrl,
    email: String(args.email).trim(),
    timeZone: String(args["time-zone"] || next.site.timeZone).trim(),
    primaryCategoryId,
    primaryGameId,
    assets: {
      ...next.site.assets,
      gameOrigin: String(args["game-origin"] || `https://mt.${siteDomain}`).replace(/\/$/, ""),
      logo: `/${siteId}-logo.webp`,
      navigationLogo: `/${siteId}-logo.png`,
    },
    seo: {
      ...next.site.seo,
      title: `${siteName} - Play Online for Free!`,
      description: `Play ${siteName} online for free in your browser.`,
      keywords: [siteName.toLowerCase()],
      twitterCreator: "",
    },
    navigation: {
      links: [
        { label: "Home", route: "home" },
        { label: "Hot Games", route: "hotGames" },
        {
          label: String(args["filter-label"] || titleFromSlug(filterPath)),
          route: "gameFilters",
        },
      ],
    },
    footer: { gameIds: [primaryGameId] },
    integrations: { makeThisBetterProjectKey: "" },
  };
  next.routes = {
    ...next.routes,
    gameCategory: categoryPath,
    gameFilters: filterPath,
  };

  if (!args.apply) {
    console.log(JSON.stringify(next, null, 2));
    console.log("\nPreview only; no files changed. Add --apply to write this manifest.");
    process.exit(0);
  }

  const backupDirectory = path.join(root, "backups", "site-init");
  fs.mkdirSync(backupDirectory, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(backupDirectory, `manifest-${timestamp}.json`);
  fs.copyFileSync(manifestPath, backupPath);
  fs.writeFileSync(manifestPath, `${JSON.stringify(next, null, 2)}\n`);

  console.log(`Site manifest updated: ${path.relative(root, manifestPath)}`);
  console.log(`Previous manifest backed up: ${path.relative(root, backupPath)}`);
  console.log("Next: replace site/content game data and public logo assets, then run npm run validate-site.");
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

