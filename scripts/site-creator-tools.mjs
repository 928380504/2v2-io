import fs from "node:fs";
import path from "node:path";
import {
  GAME_CATALOG_INSERTION_MARKER,
  buildGameDefinition,
  normalizeGameOptions,
  normalizeJsonKeys,
} from "./game-generator.mjs";
import {
  buildCompetitionInstallAudit,
  listCompetitionPacks,
} from "./competition-installer-tools.mjs";
import { resolveInside } from "./template-tools.mjs";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ROUTE = /^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*)?$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(value, label, maximum = 500) {
  const normalized = String(value || "").trim();
  if (!normalized || normalized.length > maximum) {
    throw new Error(`${label} must contain 1-${maximum} characters.`);
  }
  return normalized;
}

function slug(value, label) {
  const normalized = text(value, label, 64).toLowerCase();
  if (!SLUG.test(normalized)) {
    throw new Error(`${label} must use lowercase letters, numbers and single hyphens.`);
  }
  return normalized;
}

function route(value, label) {
  const normalized = String(value || "").trim();
  if (!ROUTE.test(normalized)) {
    throw new Error(`${label} must be / or one lowercase path segment.`);
  }
  return normalized;
}

function hostname(value) {
  const normalized = String(value || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/$/, "")
    .toLowerCase();
  if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/i.test(normalized)) {
    throw new Error("site.domain must be a valid hostname without a path.");
  }
  return normalized;
}

function object(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value;
}

function stringArray(value, label, { allowEmpty = true } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    throw new Error(`${label} must be ${allowEmpty ? "an" : "a non-empty"} array.`);
  }
  return [...new Set(value.map((item, index) => text(item, `${label}[${index}]`, 200)))];
}

function ts(value) {
  return JSON.stringify(value, null, 2)
    .replace(/^/gm, "  ")
    .trimStart();
}

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function localDate(value) {
  if (value) return text(value, "site.legalLastUpdated", 80);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date());
}

function ensureUnique(values, label) {
  const seen = new Set();
  values.forEach((value) => {
    if (seen.has(value)) throw new Error(`${label} contains a duplicate: ${value}.`);
    seen.add(value);
  });
}

function normalizeFaq(items, siteName) {
  const source = items || [
    {
      question: `How do I play ${siteName}?`,
      answer: "Select Play now in the game area. A modern browser with JavaScript and WebGL enabled is recommended.",
    },
    {
      question: "Do I need to download anything?",
      answer: "No separate installer is required. The game opens directly in the browser.",
    },
  ];
  if (!Array.isArray(source) || source.length === 0) {
    throw new Error("home.faqItems must be a non-empty array.");
  }
  return source.map((item, index) => ({
    question: text(item?.question, `home.faqItems[${index}].question`, 180),
    answer: text(item?.answer, `home.faqItems[${index}].answer`, 800),
  }));
}

export function readSiteBlueprint(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Blueprint not found: ${filePath}`);
  return readJson(filePath);
}

function defaultLegalContent(siteName, legalSiteName) {
  return {
    pages: {
      aboutUs: { path: "/about-us", navLabel: "About Us", eyebrow: "Who we are", title: `About ${legalSiteName}`, metadataTitle: "About Us", description: "A player-focused browser gaming site built for quick access and straightforward discovery.", seoDescription: `Learn about ${legalSiteName} and the browser game experience we are building.` },
      contactUs: { path: "/contact-us", navLabel: "Contact Us", eyebrow: "Get in touch", title: "Contact Us", metadataTitle: "Contact Us", description: "Tell us about a broken game, site issue, suggestion, privacy request, or rights-related concern.", seoDescription: `Contact ${legalSiteName} for support, feedback, privacy questions, or copyright matters.` },
      dmca: { path: "/dmca", navLabel: "DMCA", eyebrow: "Copyright", title: "DMCA and Copyright Policy", metadataTitle: "DMCA and Copyright Policy", description: `We respect intellectual property rights and review sufficiently detailed copyright notices concerning ${legalSiteName}.`, seoDescription: `Learn how to report alleged copyright infringement to ${legalSiteName}.`, showLastUpdated: true },
      terms: { path: "/terms-of-service", navLabel: "Terms of Service", eyebrow: "Legal", title: "Terms of Service", metadataTitle: "Terms of Service", description: `These terms govern access to ${legalSiteName}, its games, community features, and related services.`, seoDescription: `Read the terms governing access to ${legalSiteName}.`, showLastUpdated: true },
      privacy: { path: "/privacy-policy", navLabel: "Privacy Policy", eyebrow: "Privacy", title: "Privacy Policy", metadataTitle: "Privacy Policy", description: `This policy explains information processed when you visit ${legalSiteName}, play games, or use community features.`, seoDescription: `Learn what information ${legalSiteName} processes.`, showLastUpdated: true },
    },
    aboutUs: {
      whyBuilt: { title: "Why We Built This Site", paragraphs: [`${siteName} helps players discover and start browser games without a lengthy installation process.`] },
      catalog: { title: "What You Can Find Here", paragraphs: ["Browse games by popularity, freshness, and gameplay attributes.", "Games may be delivered from our infrastructure or embedded from third-party providers, and availability can change."] },
      profiles: { title: "Player Profiles and Community Activity", paragraphs: ["A mandatory account is not required unless a specific feature says otherwise.", "Local progress can be lost when browser data is cleared or a player changes device or browser."], privacyLinkLabel: "Privacy Policy" },
      independence: { title: "Independent Website", paragraphs: [`${legalSiteName} is an independent website. Third-party game names, artwork, logos, and trademarks belong to their respective owners.`] },
      contact: { title: "Contact", lead: "For support, suggestions, privacy requests, or copyright concerns, visit our", linkLabel: "Contact Us", suffix: "page or email" },
    },
  };
}

export function normalizeSiteBlueprint(raw, { root, today } = {}) {
  object(raw, "blueprint");
  if (raw.schemaVersion !== 1) throw new Error("Blueprint schemaVersion must be 1.");
  const site = object(raw.site, "site");
  const category = object(raw.category, "category");
  const filters = object(raw.filters, "filters");
  const routes = object(raw.routes, "routes");
  const home = object(raw.home, "home");
  const competition = object(raw.competition, "competition");
  const legalInput = raw.legal ? object(raw.legal, "legal") : null;
  const domain = hostname(site.domain);
  const id = slug(site.id, "site.id");
  const siteName = text(site.name, "site.name", 120);
  const brandName = text(site.brandName || domain, "site.brandName", 120);
  const legal = legalInput || defaultLegalContent(siteName, brandName);
  const categoryId = slug(category.id || `${id}-games`, "category.id");
  if (!EMAIL.test(String(site.email || ""))) throw new Error("site.email is invalid.");
  const timeZone = text(site.timeZone || "America/New_York", "site.timeZone", 80);
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
  } catch {
    throw new Error(`site.timeZone is not a valid IANA time zone: ${timeZone}.`);
  }
  if (!Array.isArray(raw.games) || raw.games.length === 0 || raw.games.length > 100) {
    throw new Error("games must contain 1-100 game records.");
  }
  const normalizedGames = raw.games.map((game) =>
    normalizeGameOptions(normalizeJsonKeys(game), {
      primaryCategoryId: categoryId,
      filterConfig: filters,
      today: today || new Date().toISOString().slice(0, 10),
    }),
  );
  ensureUnique(normalizedGames.map((game) => game.id), "games");
  normalizedGames.forEach((game) => {
    if (game.categoryId !== categoryId) {
      throw new Error(`Game ${game.id} uses unsupported category ${game.categoryId}; site:create v1 generates one primary category.`);
    }
  });
  const primaryGameId = slug(site.primaryGameId || normalizedGames[0].id, "site.primaryGameId");
  if (!normalizedGames.some((game) => game.id === primaryGameId)) {
    throw new Error(`site.primaryGameId is not present in games: ${primaryGameId}.`);
  }
  const gameIds = new Set(normalizedGames.map((game) => game.id));
  const relatedGameIds = stringArray(home.relatedGameIds || normalizedGames.slice(1, 7).map((game) => game.id), "home.relatedGameIds");
  const footerGameIds = stringArray(site.footerGameIds || normalizedGames.slice(0, 3).map((game) => game.id), "site.footerGameIds", { allowEmpty: false });
  [...relatedGameIds, ...footerGameIds].forEach((gameId) => {
    if (!gameIds.has(gameId)) throw new Error(`Referenced game is not present in games: ${gameId}.`);
  });
  const youtube = object(home.youtube, "home.youtube");
  const adapterId = slug(competition.adapterId, "competition.adapterId");
  const packs = listCompetitionPacks(root);
  const pack = packs.find((item) => item.id === adapterId);
  if (!pack) throw new Error(`Unknown competition adapter ${adapterId}. Available: ${packs.map((item) => item.id).join(", ")}.`);

  return {
    schemaVersion: 1,
    site: {
      id,
      name: siteName,
      brandName,
      domain,
      url: `https://${domain}`,
      language: text(site.language || "en", "site.language", 16),
      locale: text(site.locale || "en_US", "site.locale", 32),
      email: String(site.email).trim(),
      timeZone,
      primaryGameId,
      legalLastUpdated: localDate(site.legalLastUpdated),
      assets: {
        gameOrigin: text(site.assets?.gameOrigin || `https://mt.${domain}`, "site.assets.gameOrigin", 300).replace(/\/$/, ""),
        logo: text(site.assets?.logo, "site.assets.logo", 300),
        navigationLogo: text(site.assets?.navigationLogo, "site.assets.navigationLogo", 300),
        favicon: text(site.assets?.favicon || "/favicon.ico", "site.assets.favicon", 300),
      },
      seo: {
        title: text(site.seo?.title || `${site.name} - Play Online for Free!`, "site.seo.title", 180),
        description: text(site.seo?.description || `Play ${site.name} online for free in your browser.`, "site.seo.description", 320),
        keywords: stringArray(site.seo?.keywords || [String(site.name).toLowerCase()], "site.seo.keywords", { allowEmpty: false }),
        twitterCreator: String(site.seo?.twitterCreator || "").trim(),
      },
      footerGameIds,
      feedbackProjectKey: String(site.feedbackProjectKey || "").trim(),
    },
    routes: {
      categoryPath: route(routes.categoryPath, "routes.categoryPath"),
      filterPath: route(routes.filterPath, "routes.filterPath"),
      filterLabel: text(routes.filterLabel, "routes.filterLabel", 80),
    },
    category: {
      id: categoryId,
      title: text(category.title, "category.title", 120),
      description: text(category.description, "category.description", 500),
      catalogDescription: text(category.catalogDescription || category.description, "category.catalogDescription", 500),
      heading: text(category.heading || category.title, "category.heading", 160),
      metadataTitle: text(category.metadataTitle || `${category.title} - Play Online`, "category.metadataTitle", 180),
      metadataDescription: text(category.metadataDescription || category.description, "category.metadataDescription", 320),
      socialDescription: text(category.socialDescription || category.description, "category.socialDescription", 320),
      keywords: text(category.keywords || site.seo?.keywords?.join(", ") || site.name, "category.keywords", 500),
    },
    filters,
    games: normalizedGames,
    home: {
      backgroundImage: text(home.backgroundImage, "home.backgroundImage", 300),
      coverTagline: text(home.coverTagline, "home.coverTagline", 180),
      relatedGameIds,
      structuredImageCaption: text(home.structuredImageCaption || `${site.name} game icon`, "home.structuredImageCaption", 180),
      descriptionHtml: text(home.descriptionHtml, "home.descriptionHtml", 12000),
      heroAlt: text(home.heroAlt || `${site.name} gameplay`, "home.heroAlt", 180),
      youtube: {
        videoId: text(youtube.videoId, "home.youtube.videoId", 40),
        title: text(youtube.title || `${site.name} Gameplay`, "home.youtube.title", 180),
        description: text(youtube.description || `Watch ${site.name} gameplay and learn the basics.`, "home.youtube.description", 500),
      },
      faqItems: normalizeFaq(home.faqItems, site.name),
    },
    hotGames: {
      heading: text(raw.hotGames?.heading || "Hot Games", "hotGames.heading", 160),
      description: text(raw.hotGames?.description || "Discover the most-played games on this site.", "hotGames.description", 500),
      metadataTitle: text(raw.hotGames?.metadataTitle || `Hot Games - ${site.name}`, "hotGames.metadataTitle", 180),
      metadataDescription: text(raw.hotGames?.metadataDescription || "Browse popular browser games ranked by real play activity.", "hotGames.metadataDescription", 320),
      socialDescription: text(raw.hotGames?.socialDescription || "Browse popular browser games.", "hotGames.socialDescription", 320),
      keywords: text(raw.hotGames?.keywords || `hot games, popular games, ${site.name}`, "hotGames.keywords", 500),
    },
    filterPage: {
      heading: text(raw.filterPage?.heading || routes.filterLabel, "filterPage.heading", 160),
      filteredHeadingSuffix: text(raw.filterPage?.filteredHeadingSuffix || routes.filterLabel, "filterPage.filteredHeadingSuffix", 160),
      description: text(raw.filterPage?.description || `Browse ${routes.filterLabel.toLowerCase()} and combine filters to find a game.`, "filterPage.description", 500),
      resultNoun: text(raw.filterPage?.resultNoun || "game", "filterPage.resultNoun", 80),
      metadataTitle: text(raw.filterPage?.metadataTitle || `${routes.filterLabel} - ${site.name}`, "filterPage.metadataTitle", 180),
      metadataDescription: text(raw.filterPage?.metadataDescription || `Browse ${routes.filterLabel.toLowerCase()} and filter the catalog.`, "filterPage.metadataDescription", 320),
      attributesTitle: text(raw.filterPage?.attributesTitle || "Game Attributes", "filterPage.attributesTitle", 120),
      attributesDescription: text(raw.filterPage?.attributesDescription || "Combine the available attributes to find matching games.", "filterPage.attributesDescription", 500),
      resultsTitle: text(raw.filterPage?.resultsTitle || "Available Games", "filterPage.resultsTitle", 120),
      emptyTitle: text(raw.filterPage?.emptyTitle || "No games match this combination yet.", "filterPage.emptyTitle", 180),
      clearLabel: text(raw.filterPage?.clearLabel || "Clear filters", "filterPage.clearLabel", 80),
      clearAllLabel: text(raw.filterPage?.clearAllLabel || "Clear all", "filterPage.clearAllLabel", 80),
      legacyMessage: text(raw.filterPage?.legacyMessage || "Game filters have moved.", "filterPage.legacyMessage", 180),
      legacyLinkLabel: text(raw.filterPage?.legacyLinkLabel || `Open ${routes.filterLabel}`, "filterPage.legacyLinkLabel", 120),
      legacyMetadataTitle: text(raw.filterPage?.legacyMetadataTitle || `${routes.filterLabel} - ${site.name}`, "filterPage.legacyMetadataTitle", 180),
      legacyMetadataDescription: text(raw.filterPage?.legacyMetadataDescription || `Browse ${routes.filterLabel.toLowerCase()} by game attributes.`, "filterPage.legacyMetadataDescription", 320),
    },
    excludedGameIds: stringArray(raw.ranking?.excludedGameIds || [], "ranking.excludedGameIds"),
    competition: { adapterId, pack },
    legal,
    cloudflare: {
      schemaVersion: 1,
      accountId: String(raw.cloudflare?.accountId || "").trim(),
      pagesProject: slug(raw.cloudflare?.pagesProject || id, "cloudflare.pagesProject"),
      productionUrl: `https://${domain}`,
      productionBranch: text(raw.cloudflare?.productionBranch || "main", "cloudflare.productionBranch", 120),
      database: {
        binding: text(raw.cloudflare?.database?.binding || "DB", "cloudflare.database.binding", 64),
        name: text(raw.cloudflare?.database?.name || id, "cloudflare.database.name", 120),
        id: String(raw.cloudflare?.database?.id || "").trim(),
        previewId: String(raw.cloudflare?.database?.previewId || "").trim(),
        location: text(raw.cloudflare?.database?.location || "enam", "cloudflare.database.location", 8),
      },
      health: {
        timeoutMs: 10000,
        checks: [
          { name: "site", path: "/", expect: "html" },
          { name: "binding", path: "/api/health", expect: "ok" },
          { name: "ratings", path: "/api/comments/ratings?gameIds={primaryGameId}", expect: "ok" },
          { name: "daily leaderboard", path: "/api/leaderboard/daily?limit=1", expect: "ok" },
          { name: "ticker", path: "/api/ticker?limit=1", expect: "ok" },
        ],
      },
    },
    source: raw,
  };
}

function buildManifest(current, blueprint) {
  const { site, routes, category } = blueprint;
  return {
    ...current,
    manifestVersion: 1,
    site: {
      ...current.site,
      id: site.id,
      name: site.name,
      brandName: site.brandName,
      domain: site.domain,
      url: site.url,
      language: site.language,
      locale: site.locale,
      email: site.email,
      timeZone: site.timeZone,
      primaryCategoryId: category.id,
      primaryGameId: site.primaryGameId,
      legalLastUpdated: site.legalLastUpdated,
      assets: site.assets,
      seo: site.seo,
      navigation: {
        links: [
          { label: "Home", route: "home" },
          { label: "Hot Games", route: "hotGames" },
          { label: routes.filterLabel, route: "gameFilters" },
        ],
      },
      footer: { gameIds: site.footerGameIds },
      integrations: { makeThisBetterProjectKey: site.feedbackProjectKey },
    },
    routes: {
      ...current.routes,
      home: "/",
      hotGames: "/hot-games",
      gameCategory: routes.categoryPath,
      gameFilters: routes.filterPath,
      legacyTags: "/tags",
      aboutUs: "/about-us",
      contactUs: "/contact-us",
      terms: "/terms-of-service",
      privacy: "/privacy-policy",
      dmca: "/dmca",
    },
    features: { ...current.features, ...(blueprint.source.features || {}) },
    theme: {
      ...current.theme,
      ...(blueprint.source.theme || {}),
      layout: { ...current.theme.layout, ...(blueprint.source.theme?.layout || {}) },
      colors: { ...current.theme.colors, ...(blueprint.source.theme?.colors || {}) },
      feedback: { ...current.theme.feedback, ...(blueprint.source.theme?.feedback || {}) },
    },
  };
}

function catalogSource(games) {
  return `import type { GameDefinitionData } from "@/config/game-schema";\nimport { gameAssetUrl } from "@/site/site";\n\nexport const GAME_DEFINITIONS = {\n${games.map(buildGameDefinition).join("\n")}\n${GAME_CATALOG_INSERTION_MARKER}\n} satisfies Record<string, GameDefinitionData>;\n`;
}

function categorySource(category) {
  return `import { SITE_ROUTES } from "@/site/routes";\n\nexport const GAME_CATEGORY_DEFINITIONS = {\n  ${JSON.stringify(category.id)}: {\n    title: ${JSON.stringify(category.title)},\n    path: SITE_ROUTES.gameCategory,\n    description: ${JSON.stringify(category.catalogDescription)},\n  },\n} as const;\n`;
}

function categoryPageSource(category) {
  return `import type { Metadata } from "next";\nimport { gameCategories, type Game } from "@/config/game-catalog";\nimport { isGameRankingEligible } from "@/site/content/popular-games";\nimport { SITE_ROUTES } from "@/site/routes";\nimport { SITE_CONFIG, siteUrl } from "@/site/site";\n\nexport const PRIMARY_CATEGORY_PAGE = {\n  categoryId: ${JSON.stringify(category.id)},\n  path: SITE_ROUTES.gameCategory,\n  heading: ${JSON.stringify(category.heading)},\n  description: ${JSON.stringify(category.description)},\n  metadataTitle: ${JSON.stringify(category.metadataTitle)},\n  metadataDescription: ${JSON.stringify(category.metadataDescription)},\n  socialDescription: ${JSON.stringify(category.socialDescription)},\n  keywords: ${JSON.stringify(category.keywords)},\n} as const;\n\nexport const CATEGORY_PAGES = { primary: PRIMARY_CATEGORY_PAGE } as const;\nexport type CategoryPageKey = keyof typeof CATEGORY_PAGES;\nexport type CategoryPageDefinition = typeof PRIMARY_CATEGORY_PAGE;\n\nexport function getCategoryPageGames(page: CategoryPageDefinition): Game[] {\n  const category = gameCategories.find((item) => item.id === page.categoryId);\n  return category ? category.games.filter((game) => isGameRankingEligible(game.id)) : [];\n}\n\nexport function createCategoryPageMetadata(page: CategoryPageDefinition = PRIMARY_CATEGORY_PAGE): Metadata {\n  const canonical = siteUrl(page.path);\n  return {\n    title: page.metadataTitle, description: page.metadataDescription, keywords: page.keywords,\n    metadataBase: new URL(SITE_CONFIG.url), alternates: { canonical },\n    openGraph: { title: page.metadataTitle, description: page.socialDescription, url: canonical, type: "website", siteName: SITE_CONFIG.name },\n    twitter: { card: "summary", title: page.metadataTitle, description: page.socialDescription },\n  };\n}\n`;
}

function homeSource(home) {
  return `/** Site-specific home-page copy and game selection. */\nexport const HOME_PAGE = {\n  player: {\n    backgroundImage: ${JSON.stringify(home.backgroundImage)},\n    coverTagline: ${JSON.stringify(home.coverTagline)},\n    relatedGameIds: ${ts(home.relatedGameIds)},\n  },\n  structuredImageCaption: ${JSON.stringify(home.structuredImageCaption)},\n  article: {\n    description: ${JSON.stringify(home.descriptionHtml)},\n    heroAlt: ${JSON.stringify(home.heroAlt)},\n    youtube: ${ts(home.youtube)},\n    faqItems: ${ts(home.faqItems)},\n  },\n} as const;\n`;
}

function hotGamesSource(page) {
  return `import type { Metadata } from "next";\nimport { gameCategories, type Game } from "@/config/game-catalog";\nimport { sortByPopularGameOrder } from "@/config/popular-games";\nimport { SITE_ROUTES } from "@/site/routes";\nimport { SITE_CONFIG, siteUrl } from "@/site/site";\n\nexport const HOT_GAMES_PAGE = {\n  path: SITE_ROUTES.hotGames,\n  heading: ${JSON.stringify(page.heading)},\n  description: ${JSON.stringify(page.description)},\n  metadataTitle: ${JSON.stringify(page.metadataTitle)},\n  metadataDescription: ${JSON.stringify(page.metadataDescription)},\n  socialDescription: ${JSON.stringify(page.socialDescription)},\n  keywords: ${JSON.stringify(page.keywords)},\n} as const;\n\nexport function getHotGames(): Game[] {\n  return sortByPopularGameOrder(gameCategories.flatMap((category) => category.games), {});\n}\n\nexport function createHotGamesMetadata(): Metadata {\n  const canonical = siteUrl(HOT_GAMES_PAGE.path);\n  return { title: HOT_GAMES_PAGE.metadataTitle, description: HOT_GAMES_PAGE.metadataDescription, keywords: HOT_GAMES_PAGE.keywords, metadataBase: new URL(SITE_CONFIG.url), alternates: { canonical }, openGraph: { title: HOT_GAMES_PAGE.metadataTitle, description: HOT_GAMES_PAGE.socialDescription, url: canonical, type: "website", siteName: SITE_CONFIG.name }, twitter: { card: "summary", title: HOT_GAMES_PAGE.metadataTitle, description: HOT_GAMES_PAGE.socialDescription } };\n}\n`;
}

function filterPageSource(page) {
  return `import type { Metadata } from "next";\nimport { SITE_ROUTES } from "@/site/routes";\nimport { SITE_CONFIG, siteUrl } from "@/site/site";\n\nexport const GAME_FILTERS_PAGE = {\n  path: SITE_ROUTES.gameFilters, legacyPath: SITE_ROUTES.legacyTags,\n  heading: ${JSON.stringify(page.heading)}, filteredHeadingSuffix: ${JSON.stringify(page.filteredHeadingSuffix)},\n  description: ${JSON.stringify(page.description)}, resultNoun: ${JSON.stringify(page.resultNoun)},\n  attributesTitle: ${JSON.stringify(page.attributesTitle)}, attributesDescription: ${JSON.stringify(page.attributesDescription)},\n  resultsTitle: ${JSON.stringify(page.resultsTitle)}, emptyTitle: ${JSON.stringify(page.emptyTitle)}, clearLabel: ${JSON.stringify(page.clearLabel)}, clearAllLabel: ${JSON.stringify(page.clearAllLabel)},\n  legacyMessage: ${JSON.stringify(page.legacyMessage)}, legacyLinkLabel: ${JSON.stringify(page.legacyLinkLabel)}, siteName: SITE_CONFIG.brandName,\n  metadataTitle: ${JSON.stringify(page.metadataTitle)}, metadataDescription: ${JSON.stringify(page.metadataDescription)},\n  legacyMetadataTitle: ${JSON.stringify(page.legacyMetadataTitle)}, legacyMetadataDescription: ${JSON.stringify(page.legacyMetadataDescription)},\n} as const;\n\nexport type GameFiltersPageDefinition = typeof GAME_FILTERS_PAGE;\nexport function createGameFiltersMetadata(): Metadata { return { title: GAME_FILTERS_PAGE.metadataTitle, description: GAME_FILTERS_PAGE.metadataDescription, alternates: { canonical: siteUrl(GAME_FILTERS_PAGE.path) } }; }\nexport function createLegacyTagsMetadata(): Metadata { return { title: GAME_FILTERS_PAGE.legacyMetadataTitle, description: GAME_FILTERS_PAGE.legacyMetadataDescription, alternates: { canonical: siteUrl(GAME_FILTERS_PAGE.path) }, robots: { index: false, follow: true } }; }\n`;
}

function rankingSource(excludedIds) {
  return `/** Games that remain playable but must not appear in either game ranking. */\nexport const gameRankingExcludedIds = new Set<string>(${ts(excludedIds)});\nexport function isGameRankingEligible(gameId: string): boolean { return !gameRankingExcludedIds.has(gameId); }\n`;
}

function legalSource(siteName, legal) {
  if (legal) {
    return `import type { Metadata } from "next";
import { SITE_CONFIG, siteUrl } from "@/site/site";

export const LEGAL_SITE = {
  name: SITE_CONFIG.brandName,
  url: SITE_CONFIG.url,
  email: SITE_CONFIG.email,
  lastUpdated: SITE_CONFIG.legalLastUpdated,
} as const;

export const LEGAL_PAGES = ${ts(legal.pages)} as const;
export const ABOUT_US_CONTENT = ${ts(legal.aboutUs)} as const;

export type LegalPageKey = keyof typeof LEGAL_PAGES;
export function createLegalMetadata(pageKey: LegalPageKey): Metadata {
  const page = LEGAL_PAGES[pageKey];
  return { title: \`${'${page.metadataTitle}'} - ${'${LEGAL_SITE.name}'}\`, description: page.seoDescription, alternates: { canonical: siteUrl(page.path) } };
}
`;
  }
  const whyBuilt = JSON.stringify(
    `${siteName} helps players discover and start browser games without a lengthy installation process.`,
  );
  return `import type { Metadata } from "next";
import { SITE_ROUTES } from "@/site/routes";
import { SITE_CONFIG, siteUrl } from "@/site/site";

export const LEGAL_SITE = {
  name: SITE_CONFIG.brandName,
  url: SITE_CONFIG.url,
  email: SITE_CONFIG.email,
  lastUpdated: SITE_CONFIG.legalLastUpdated,
} as const;

export const LEGAL_PAGES = {
  aboutUs: { path: SITE_ROUTES.aboutUs, navLabel: "About Us", eyebrow: "Who we are", title: \`About \${LEGAL_SITE.name}\`, metadataTitle: "About Us", description: "A player-focused browser gaming site built for quick access and straightforward discovery.", seoDescription: \`Learn about \${LEGAL_SITE.name} and the browser game experience we are building.\` },
  contactUs: { path: SITE_ROUTES.contactUs, navLabel: "Contact Us", eyebrow: "Get in touch", title: "Contact Us", metadataTitle: "Contact Us", description: "Tell us about a broken game, site issue, suggestion, privacy request, or rights-related concern.", seoDescription: \`Contact \${LEGAL_SITE.name} for support, feedback, privacy questions, or copyright matters.\` },
  dmca: { path: SITE_ROUTES.dmca, navLabel: "DMCA", eyebrow: "Copyright", title: "DMCA and Copyright Policy", metadataTitle: "DMCA and Copyright Policy", description: \`We respect intellectual property rights and review sufficiently detailed copyright notices concerning \${LEGAL_SITE.name}.\`, seoDescription: \`Learn how to report alleged copyright infringement to \${LEGAL_SITE.name}.\`, showLastUpdated: true },
  terms: { path: SITE_ROUTES.terms, navLabel: "Terms of Service", eyebrow: "Legal", title: "Terms of Service", metadataTitle: "Terms of Service", description: \`These terms govern access to \${LEGAL_SITE.name}, its games, community features, and related services.\`, seoDescription: \`Read the terms governing access to \${LEGAL_SITE.name}.\`, showLastUpdated: true },
  privacy: { path: SITE_ROUTES.privacy, navLabel: "Privacy Policy", eyebrow: "Privacy", title: "Privacy Policy", metadataTitle: "Privacy Policy", description: \`This policy explains information processed when you visit \${LEGAL_SITE.name}, play games, or use community features.\`, seoDescription: \`Learn what information \${LEGAL_SITE.name} processes.\`, showLastUpdated: true },
} as const;

export const ABOUT_US_CONTENT = {
  whyBuilt: { title: "Why We Built This Site", paragraphs: [${whyBuilt}] },
  catalog: { title: "What You Can Find Here", paragraphs: ["Browse games by popularity, freshness, and gameplay attributes.", "Games may be delivered from our infrastructure or embedded from third-party providers, and availability can change."] },
  profiles: { title: "Player Profiles and Community Activity", paragraphs: ["A mandatory account is not required unless a specific feature says otherwise.", "Local progress can be lost when browser data is cleared or a player changes device or browser."], privacyLinkLabel: "Privacy Policy" },
  independence: { title: "Independent Website", paragraphs: [\`\${LEGAL_SITE.name} is an independent website. Third-party game names, artwork, logos, and trademarks belong to their respective owners.\`] },
  contact: { title: "Contact", lead: "For support, suggestions, privacy requests, or copyright concerns, visit our", linkLabel: "Contact Us", suffix: "page or email" },
} as const;

export type LegalPageKey = keyof typeof LEGAL_PAGES;
export function createLegalMetadata(pageKey: LegalPageKey): Metadata {
  const page = LEGAL_PAGES[pageKey];
  return { title: \`\${page.metadataTitle} - \${LEGAL_SITE.name}\`, description: page.seoDescription, alternates: { canonical: siteUrl(page.path) } };
}
`;
}

function resourceChecklist(root, blueprint) {
  const resources = [];
  const add = (kind, owner, value) => {
    const local = value.startsWith("/");
    const absolutePath = local ? path.join(root, "public", value.replace(/^\/+/, "")) : null;
    resources.push({ kind, owner, value, source: local ? "public" : /^https?:\/\//i.test(value) ? "remote" : "game-origin", status: local ? (fs.existsSync(absolutePath) ? "present" : "missing") : "external" });
  };
  Object.entries(blueprint.site.assets).forEach(([kind, value]) => add(kind, "site", value));
  add("homeBackground", "home", blueprint.home.backgroundImage);
  blueprint.games.forEach((game) => {
    add("logo", game.id, game.image);
    add("cover", game.id, game.coverImage);
    add("playUrl", game.id, game.playUrl);
  });
  return { schemaVersion: 1, note: "site:create never downloads or invents licensed assets. Supply every missing local resource before apply/build.", resources };
}

function editableGame(game) {
  const value = {
    id: game.id,
    categoryId: game.categoryId,
    title: game.title,
    description: game.description,
    metadataDescription: game.metadataDescription,
    image: game.image,
    playUrl: game.playUrl,
    coverImage: game.coverImage,
    coverAlt: game.coverAlt,
    developer: game.developer,
    technology: game.technology,
    platforms: game.platforms,
    tags: game.tags,
    plays: game.plays,
    rating: game.rating,
    ratingCount: game.ratingCount,
    favorites: game.favorites,
    likes: game.likes,
    siteAddedAt: game.siteAddedAt,
    hot: game.isHot,
    matchBridge: game.matchBridge,
  };
  if (game.createdAt) value.createdAt = game.createdAt;
  if (game.youtubeId) {
    value.youtubeId = game.youtubeId;
    value.youtubeTitle = game.youtubeTitle;
    value.youtubeDescription = game.youtubeDescription;
  }
  if (game.detailHtml) value.detailHtml = game.detailHtml;
  game.attributeEntries.forEach((entry) => {
    value[entry.attributeKey] = entry.multiple ? entry.values : entry.values[0];
  });
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== null && item !== undefined));
}

export function toEditableSiteBlueprint(blueprint) {
  return {
    schemaVersion: 1,
    site: {
      id: blueprint.site.id,
      name: blueprint.site.name,
      brandName: blueprint.site.brandName,
      domain: blueprint.site.domain,
      email: blueprint.site.email,
      timeZone: blueprint.site.timeZone,
      primaryGameId: blueprint.site.primaryGameId,
      legalLastUpdated: blueprint.site.legalLastUpdated,
      assets: blueprint.site.assets,
      seo: blueprint.site.seo,
      footerGameIds: blueprint.site.footerGameIds,
      feedbackProjectKey: blueprint.site.feedbackProjectKey,
    },
    routes: {
      categoryPath: blueprint.routes.categoryPath,
      filterPath: blueprint.routes.filterPath,
      filterLabel: blueprint.routes.filterLabel,
    },
    category: blueprint.category,
    filters: blueprint.filters,
    games: blueprint.games.map(editableGame),
    home: blueprint.home,
    hotGames: blueprint.hotGames,
    filterPage: blueprint.filterPage,
    cloudflare: {
      accountId: blueprint.cloudflare.accountId,
      pagesProject: blueprint.cloudflare.pagesProject,
      productionBranch: blueprint.cloudflare.productionBranch,
      database: blueprint.cloudflare.database,
    },
    competition: { adapterId: blueprint.competition.adapterId },
    ranking: { excludedGameIds: blueprint.excludedGameIds },
    ...(blueprint.legal ? { legal: blueprint.legal } : {}),
    features: blueprint.source.features || {},
    theme: blueprint.source.theme || {},
  };
}

function ratingsSnapshot(root, games) {
  const filePath = path.join(root, "site", "generated", "ratings.generated.json");
  let current = {};
  if (fs.existsSync(filePath)) {
    try {
      current = readJson(filePath);
    } catch {
      current = {};
    }
  }
  const gameIds = new Set(games.map((game) => game.id));
  const entries = Object.entries(current).filter(([gameId]) => gameIds.has(gameId));
  const existingIds = new Set(entries.map(([gameId]) => gameId));
  games.forEach((game) => {
    if (!existingIds.has(game.id)) entries.push([game.id, { score: 0, votes: 0 }]);
  });
  return Object.fromEntries(entries);
}

export function buildSiteCreationPlan({ root, blueprint: rawBlueprint }) {
  const blueprint = normalizeSiteBlueprint(rawBlueprint, { root });
  const manifestPath = path.join(root, "site", "manifest.json");
  const currentManifest = readJson(manifestPath);
  const writes = new Map();
  const put = (relativePath, contents) => writes.set(resolveInside(root, relativePath), contents);
  put("site/blueprint.json", json(toEditableSiteBlueprint(blueprint)));
  put("site/manifest.json", json(buildManifest(currentManifest, blueprint)));
  put("site/game-filters.json", json(blueprint.filters));
  put("site/cloudflare.json", json(blueprint.cloudflare));
  put("site/content/game-catalog-data.ts", catalogSource(blueprint.games));
  put("site/content/game-categories.ts", categorySource(blueprint.category));
  put("site/content/category-pages.ts", categoryPageSource(blueprint.category));
  put("site/content/home-page.ts", homeSource(blueprint.home));
  put("site/content/hot-games-page.ts", hotGamesSource(blueprint.hotGames));
  put("site/content/game-filters-page.ts", filterPageSource(blueprint.filterPage));
  put("site/content/popular-games.ts", rankingSource(blueprint.excludedGameIds));
  put("site/content/legal-pages.ts", legalSource(blueprint.site.name, blueprint.legal));
  put("site/generated/ratings.generated.json", json(ratingsSnapshot(root, blueprint.games)));
  put("site/generated/resource-checklist.json", json(resourceChecklist(root, blueprint)));

  const competitionAudit = buildCompetitionInstallAudit({
    root,
    pack: blueprint.competition.pack,
  });
  if (competitionAudit.status === "blocked") {
    throw new Error(
      `Competition adapter cannot be prepared: ${competitionAudit.blockers.join(" ")}`,
    );
  }
  for (const [filePath, contents] of competitionAudit.writes || []) {
    const relativePath = path.relative(root, filePath).replaceAll("\\", "/");
    if (competitionAudit.changes.includes(relativePath)) writes.set(filePath, contents);
  }

  const changes = [];
  const additions = [];
  const updates = [];
  for (const [filePath, contents] of writes) {
    const next = Buffer.isBuffer(contents) ? contents : Buffer.from(contents);
    const exists = fs.existsSync(filePath);
    if (exists && fs.readFileSync(filePath).equals(next)) continue;
    const relativePath = path.relative(root, filePath).replaceAll("\\", "/");
    changes.push(relativePath);
    (exists ? updates : additions).push(relativePath);
  }
  return { blueprint, writes, changes, additions, updates, status: changes.length ? "ready" : "current" };
}

export function applySiteCreationPlan({ root, plan, backupRoot, validate }) {
  if (plan.status !== "ready") throw new Error(`site:create cannot apply while status is ${plan.status}.`);
  for (const relativePath of plan.updates) {
    const source = resolveInside(root, relativePath);
    const backup = resolveInside(backupRoot, relativePath);
    fs.mkdirSync(path.dirname(backup), { recursive: true });
    fs.copyFileSync(source, backup);
  }
  const added = [];
  try {
    for (const [filePath, contents] of plan.writes) {
      const relativePath = path.relative(root, filePath).replaceAll("\\", "/");
      if (!plan.changes.includes(relativePath)) continue;
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, contents);
      if (plan.additions.includes(relativePath)) added.push(relativePath);
    }
    validate();
  } catch (error) {
    added.forEach((relativePath) => {
      const target = resolveInside(root, relativePath);
      if (fs.existsSync(target)) fs.unlinkSync(target);
    });
    plan.updates.forEach((relativePath) => {
      const backup = resolveInside(backupRoot, relativePath);
      const target = resolveInside(root, relativePath);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(backup, target);
    });
    throw error;
  }
}
