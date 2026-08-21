import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { discoverLegacyRoutes, inferLegacyDomain } from "./legacy-adoption-tools.mjs";
import {
  normalizeSiteBlueprint,
  toEditableSiteBlueprint,
} from "./site-creator-tools.mjs";

const SYNTHETIC_CALLS = new Set([
  "getRandomDate",
  "getRandomPlays",
  "getRandomRating",
  "seededRandom",
]);
const RANKING_EXCLUSIONS = [
  "classroom",
  "github",
  "old-version",
  "openprocessing",
  "poor-bunny",
  "unblocked",
];

function read(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "legacy-game";
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function compactSentence(value, fallback) {
  const source = text(value) || fallback;
  const sentence = source.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim() || source;
  return sentence.slice(0, 180);
}

function routeSegments(routeValue) {
  return String(routeValue || "")
    .split(/[?#]/, 1)[0]
    .split("/")
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment));
}

function quotedValues(source) {
  return [...String(source || "").matchAll(/["']([^"']+)["']/g)].map((match) => match[1]);
}

function makeIssue(issues, severity, code, message, extra = {}) {
  issues.push({ severity, code, message, ...extra });
}

function unwrap(node) {
  let current = node;
  while (
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isParenthesizedExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isNonNullExpression(current)
  ) current = current.expression;
  return current;
}

function variableDeclarations(sourceFile) {
  const declarations = new Map();
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      if (!declarations.has(node.name.text)) declarations.set(node.name.text, node.initializer);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return declarations;
}

function propertyName(node, evaluate) {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) {
    return node.text;
  }
  if (ts.isComputedPropertyName(node)) return String(evaluate(node.expression));
  return null;
}

export function evaluateLegacyLiteral(source, variableName, { fileName = "legacy.ts" } = {}) {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const declarations = variableDeclarations(sourceFile);
  const resolving = new Set();
  const skippedCalls = new Set();

  const evaluate = (input) => {
    const node = unwrap(input);
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    if (ts.isNumericLiteral(node)) return Number(node.text);
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (node.kind === ts.SyntaxKind.NullKeyword) return null;
    if (ts.isIdentifier(node)) {
      if (node.text === "undefined") return undefined;
      const initializer = declarations.get(node.text);
      if (!initializer || resolving.has(node.text)) return undefined;
      resolving.add(node.text);
      try {
        return evaluate(initializer);
      } finally {
        resolving.delete(node.text);
      }
    }
    if (ts.isArrayLiteralExpression(node)) {
      return node.elements.map((element) => evaluate(element)).filter((value) => value !== undefined);
    }
    if (ts.isObjectLiteralExpression(node)) {
      const result = {};
      node.properties.forEach((property) => {
        if (ts.isPropertyAssignment(property)) {
          const name = propertyName(property.name, evaluate);
          const value = evaluate(property.initializer);
          if (name !== null && value !== undefined) result[name] = value;
        } else if (ts.isShorthandPropertyAssignment(property)) {
          const value = evaluate(property.name);
          if (value !== undefined) result[property.name.text] = value;
        } else if (ts.isSpreadAssignment(property)) {
          const value = evaluate(property.expression);
          if (value && typeof value === "object" && !Array.isArray(value)) Object.assign(result, value);
        }
      });
      return result;
    }
    if (ts.isTemplateExpression(node)) {
      return node.templateSpans.reduce(
        (result, span) => result + String(evaluate(span.expression) ?? "") + span.literal.text,
        node.head.text,
      );
    }
    if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken) {
      return -Number(evaluate(node.operand));
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      return evaluate(node.left) + evaluate(node.right);
    }
    if (ts.isCallExpression(node)) {
      const callee = node.expression.getText(sourceFile);
      if (callee === "Number") return Number(evaluate(node.arguments[0]));
      if (callee === "String") return String(evaluate(node.arguments[0]));
      if (callee === "gameAssetUrl") return evaluate(node.arguments[0]);
      const simpleName = ts.isIdentifier(node.expression) ? node.expression.text : callee;
      if (SYNTHETIC_CALLS.has(simpleName) || callee.endsWith(".toFixed")) {
        skippedCalls.add(callee);
        return undefined;
      }
      skippedCalls.add(callee);
      return undefined;
    }
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression)) {
      if (node.expression.text === "URL") return evaluate(node.arguments?.[0]);
      skippedCalls.add(`new ${node.expression.text}`);
      return undefined;
    }
    return undefined;
  };

  const initializer = declarations.get(variableName);
  if (!initializer) return { value: undefined, skippedCalls: [] };
  return { value: evaluate(initializer), skippedCalls: [...skippedCalls].sort() };
}

function metadataFromLayout(targetRoot) {
  const source = read(path.join(targetRoot, "app", "layout.tsx"));
  const pick = (pattern) => source.match(pattern)?.[1]?.trim() || "";
  const title = pick(/\btitle:\s*["'`]([^"'`]+)["'`]/);
  const description = pick(/\bdescription:\s*["'`]([^"'`]+)["'`]/);
  const applicationName = pick(/\bapplicationName:\s*["'`]([^"'`]+)["'`]/);
  const siteName = pick(/\bsiteName:\s*["'`]([^"'`]+)["'`]/);
  const logo = pick(/\burl:\s*["'`]([^"'`]+\.(?:png|jpe?g|webp|avif|gif))["'`]/i);
  const favicon = pick(/\bicon:\s*["'`]([^"'`]+)["'`]/) || "/favicon.ico";
  const twitterCreator = pick(/\bcreator:\s*["'`](@[^"'`]+)["'`]/);
  const keywordsBlock = source.match(/\bkeywords:\s*\[([\s\S]*?)\]/)?.[1] || "";
  return {
    title,
    description,
    name: applicationName || siteName || title.replace(/\s+-\s+.*$/, ""),
    logo,
    favicon,
    twitterCreator,
    keywords: quotedValues(keywordsBlock),
  };
}

function deriveCoverImage(game) {
  const image = text(game.image);
  if (!image) return "";
  return image
    .replace(/-logo\.(webp|png|jpe?g|avif)$/i, "-bj.$1")
    .replace(/\/logo\.(webp|png|jpe?g|avif)$/i, "/background.$1");
}

function extractDetail(targetRoot, game, categoryId, issues) {
  const pagePath = path.join(targetRoot, "app", ...routeSegments(game.url), "page.tsx");
  const source = read(pagePath);
  if (!source) {
    makeIssue(
      issues,
      "warning",
      "missing_detail_page",
      `No legacy detail page was found for ${game.id}; a placeholder play URL was generated.`,
      { gameId: game.id, file: path.relative(targetRoot, pagePath).replaceAll("\\", "/") },
    );
    return {
      pagePath,
      playUrl: `${categoryId}/${game.id}/index.html`,
      coverImage: deriveCoverImage(game),
      detailHtml: "",
      youtubeId: "",
    };
  }
  const description = evaluateLegacyLiteral(source, "gameDescription", {
    fileName: path.basename(pagePath),
  }).value;
  const playUrl = source.match(/\bplayUrl\s*(?::|=)\s*["'`]([^"'`]+)["'`]/)?.[1] || "";
  const imageMatches = [...source.matchAll(/<img[\s\S]*?\bsrc=["']([^"']+)["']/gi)];
  const coverImage = imageMatches[0]?.[1] || deriveCoverImage(game);
  const youtubeId = source.match(/\bvideoId=["']([^"']+)["']/)?.[1] || "";
  if (!playUrl) {
    makeIssue(
      issues,
      "warning",
      "missing_play_url",
      `The legacy detail page for ${game.id} does not expose a literal playUrl.`,
      { gameId: game.id, file: path.relative(targetRoot, pagePath).replaceAll("\\", "/") },
    );
  }
  return {
    pagePath,
    playUrl: playUrl || `${categoryId}/${game.id}/index.html`,
    coverImage,
    detailHtml: typeof description === "string" ? description.trim() : "",
    youtubeId,
  };
}

function available(group, slugValue) {
  return group.options.some((option) => option.slug === slugValue);
}

function inferredAttributes(game, filterConfiguration) {
  const haystack = `${game.title} ${game.description}`.toLowerCase();
  const values = {};
  filterConfiguration.groups.forEach((group) => {
    let selected = [];
    if (group.key === "players") {
      if (available(group, "single-player") && /\b(single|solo|offline|story)\b/.test(haystack)) selected.push("single-player");
      if (available(group, "multiplayer") && /\b(multiplayer|online|opponents?|players?|pvp)\b/.test(haystack)) selected.push("multiplayer");
      if (available(group, "two-player") && /\b(1v1|2v2|two[- ]player|duel)\b/.test(haystack)) selected.push("two-player");
    } else if (group.key === "controls") {
      if (available(group, "keyboard-mouse")) selected.push("keyboard-mouse");
      if (available(group, "touch") && /\b(mobile|touch|tablet|phone)\b/.test(haystack)) selected.push("touch");
      if (available(group, "gamepad") && /\b(gamepad|controller)\b/.test(haystack)) selected.push("gamepad");
    } else if (group.key === "loading") {
      selected = group.generatorDefaultValues || group.defaultValues || [];
    } else if (group.key === "gameplay") {
      if (available(group, "pvp") && /\b(pvp|multiplayer|battle|combat|opponents?|fight|1v1|2v2|3v3|4v4|duel)\b/.test(haystack)) selected.push("pvp");
      if (available(group, "building") && /\b(build|building|construct|structures?)\b/.test(haystack)) selected.push("building");
      if (available(group, "battle-royale") && /\bbattle royale\b/.test(haystack)) selected.push("battle-royale");
      if (available(group, "story") && /\b(story|campaign|mission)\b/.test(haystack)) selected.push("story");
    } else if (group.key === "perspective") {
      if (available(group, "first-person") && /\b(first[- ]person|fps)\b/.test(haystack)) selected.push("first-person");
      if (available(group, "third-person") && /\b(third[- ]person|building|battle royale)\b/.test(haystack)) selected.push("third-person");
      if (available(group, "top-down") && /\b(top[- ]down|overhead|isometric)\b/.test(haystack)) selected.push("top-down");
    }
    if (!selected.length) selected = group.generatorDefaultValues || group.defaultValues || [];
    selected = [...new Set(selected)].filter((value) => available(group, value));
    if (!group.multiple) selected = selected.slice(0, 1);
    values[group.attributeKey] = group.multiple ? selected : selected[0];
  });
  return values;
}

function parseFaq(targetRoot) {
  const faqPath = path.join(targetRoot, "components", "TxT", "Faq.tsx");
  const source = read(faqPath);
  const result = evaluateLegacyLiteral(source, "faqs", { fileName: "Faq.tsx" }).value;
  if (!Array.isArray(result)) return [];
  return result
    .filter((item) => text(item?.question) && text(item?.answer))
    .map((item) => ({ question: text(item.question), answer: text(item.answer) }))
    .slice(0, 12);
}

function rootPageData(targetRoot) {
  const source = read(path.join(targetRoot, "app", "page.tsx"));
  const coverSource = [
    path.join(targetRoot, "components", "YouXi", "IF-Cover.tsx"),
    path.join(targetRoot, "components", "templates-3", "GameCover3.tsx"),
    path.join(targetRoot, "components", "YouXi", "Game-Cover.tsx"),
  ].map(read).join("\n");
  const coverAssets = quotedValues(coverSource)
    .filter((value) => /\.(?:png|jpe?g|webp|avif|gif)$/i.test(value));
  return {
    gameUrl: source.match(/\bgameUrl=["']([^"']+)["']/)?.[1] || "",
    videoId: source.match(/\bvideoId=["']([^"']+)["']/)?.[1] || "",
    videoTitle: source.match(/\btitle=["']([^"']+\bGameplay)["']/)?.[1] || "",
    videoDescription: source.match(/\bdescription=["']([^"']+)["']/)?.[1] || "",
    coverImage: coverAssets.find((value) => /(?:-bj|background|cover)\./i.test(value)) || "",
    logoImage: coverAssets.find((value) => /(?:-logo|logo)\./i.test(value)) || "",
  };
}

function pickPrimaryGame(games, siteId, siteName, rootGameUrl) {
  const urlMatch = games.find((game) => rootGameUrl.includes(`/${game.id}/`));
  if (urlMatch) return urlMatch;
  const idMatch = games.find((game) => game.id === siteId);
  if (idMatch) return idMatch;
  const nameSlug = slug(siteName);
  return games.find((game) => slug(game.title) === nameSlug) || games[0];
}

function legacyGameCategories(targetRoot, issues) {
  const gamesPath = path.join(targetRoot, "config", "games.ts");
  const source = read(gamesPath);
  if (!source) {
    makeIssue(issues, "blocker", "missing_game_catalog", "config/games.ts was not found.");
    return [];
  }
  const result = evaluateLegacyLiteral(source, "gameCategories", { fileName: gamesPath });
  if (result.skippedCalls.length) {
    makeIssue(
      issues,
      "info",
      "synthetic_values_ignored",
      `Synthetic or executable catalog values were ignored: ${result.skippedCalls.join(", ")}.`,
    );
  }
  if (!Array.isArray(result.value)) {
    makeIssue(issues, "blocker", "unreadable_game_catalog", "gameCategories could not be read as a static array.");
    return [];
  }
  return result.value;
}

function inferredGameOrigin(domain, games) {
  for (const game of games) {
    try {
      const url = new URL(game.image);
      if (url.hostname.startsWith("mt.")) return url.origin;
    } catch {
      // Relative resources use the normal default below.
    }
  }
  return domain ? `https://mt.${domain}` : "";
}

function legacyRedirects(routes) {
  const mappings = new Map([
    ["/BQ", "/dmca"],
    ["/TK", "/terms-of-service"],
    ["/YS", "/privacy-policy"],
  ]);
  return routes
    .filter((routeValue) => mappings.has(routeValue))
    .map((from) => ({ from, to: mappings.get(from) }));
}

export function extractLegacySite({
  targetRoot,
  templateRoot,
  baseBlueprintPath = path.join(templateRoot, "site", "blueprint.json"),
  today = new Date().toISOString().slice(0, 10),
} = {}) {
  const resolvedTarget = path.resolve(targetRoot || "");
  const resolvedTemplate = path.resolve(templateRoot || process.cwd());
  const issues = [];
  if (!targetRoot || !fs.existsSync(resolvedTarget)) {
    throw new Error(`Legacy target does not exist: ${resolvedTarget}`);
  }
  const packagePath = path.join(resolvedTarget, "package.json");
  const packageJson = JSON.parse(read(packagePath) || "{}");
  if (packageJson.name !== "stimulation-clicker") {
    makeIssue(issues, "blocker", "unsupported_template", `Expected package name stimulation-clicker, found ${packageJson.name || "unknown"}.`);
  }
  const baseBlueprint = JSON.parse(read(path.resolve(baseBlueprintPath)) || "{}");
  if (baseBlueprint.schemaVersion !== 1) throw new Error(`Invalid base blueprint: ${baseBlueprintPath}`);
  const metadata = metadataFromLayout(resolvedTarget);
  const domain = inferLegacyDomain(resolvedTarget);
  if (!domain) makeIssue(issues, "blocker", "missing_domain", "The legacy domain could not be inferred.");
  const categories = legacyGameCategories(resolvedTarget, issues);
  if (categories.length !== 1) {
    makeIssue(issues, "blocker", "unsupported_category_count", `The extractor currently requires exactly one category; found ${categories.length}.`);
  }
  const category = categories[0] || {};
  const legacyGames = Array.isArray(category.games) ? category.games : [];
  if (!legacyGames.length) makeIssue(issues, "blocker", "empty_game_catalog", "The legacy category does not contain games.");
  if (legacyGames.length > 100) makeIssue(issues, "blocker", "too_many_games", `The new blueprint supports at most 100 games; found ${legacyGames.length}.`);
  const siteId = slug((domain || path.basename(resolvedTarget)).replace(/^www\./, "").split(".")[0]);
  const siteName = metadata.name || text(category.title).replace(/\s+Games$/i, "") || siteId;
  const rootData = rootPageData(resolvedTarget);
  const filterConfiguration = structuredClone(baseBlueprint.filters);
  const extractedGames = legacyGames.map((legacyGame) => {
    const id = slug(legacyGame.id);
    const description = text(legacyGame.description) || `Play ${legacyGame.title || id} online in your browser and explore its core gameplay, controls, and challenges.`;
    const detail = extractDetail(resolvedTarget, { ...legacyGame, id }, category.id || siteId, issues);
    const dateSource = fs.existsSync(detail.pagePath) ? fs.statSync(detail.pagePath).mtime : fs.statSync(packagePath).mtime;
    const migrated = {
      id,
      categoryId: slug(category.id || `${siteId}-games`),
      title: text(legacyGame.title) || id,
      description: description.length >= 40 ? description : `${description} Play online in your browser and discover the full game experience.`,
      metadataDescription: description.slice(0, 320),
      image: text(legacyGame.image) || `${category.id}/${id}/${id}-logo.webp`,
      playUrl: detail.playUrl,
      coverImage: detail.coverImage || `${category.id}/${id}/${id}-bj.webp`,
      coverAlt: `${text(legacyGame.title) || id} Background`,
      developer: "Independent Studio",
      technology: "HTML5",
      platforms: ["Web Browser"],
      plays: 0,
      ratingCount: 0,
      favorites: 0,
      likes: 0,
      siteAddedAt: dateSource.toISOString().slice(0, 10),
      hot: legacyGame.isHot === true,
      matchBridge: false,
      detailHtml: detail.detailHtml || undefined,
      youtubeId: detail.youtubeId || undefined,
      ...inferredAttributes(legacyGame, filterConfiguration),
    };
    return migrated;
  });
  const rootGameExists = extractedGames.some(
    (game) => game.id === siteId || (rootData.gameUrl && rootData.gameUrl.includes(`/${game.id}/`)),
  );
  if (rootData.gameUrl && !rootGameExists) {
    const primaryDescription = metadata.description || `Play ${siteName} online in your browser and explore its core gameplay, controls, and challenges.`;
    extractedGames.unshift({
      id: siteId,
      categoryId: slug(category.id || `${siteId}-games`),
      title: siteName,
      description: primaryDescription,
      metadataDescription: primaryDescription.slice(0, 320),
      image: rootData.logoImage || metadata.logo || `/${siteId}-logo.webp`,
      playUrl: rootData.gameUrl,
      coverImage: rootData.coverImage || metadata.logo || `/${siteId}-logo.webp`,
      coverAlt: `${siteName} Background`,
      developer: "Independent Studio",
      technology: "HTML5",
      platforms: ["Web Browser"],
      plays: 0,
      ratingCount: 0,
      favorites: 0,
      likes: 0,
      siteAddedAt: fs.statSync(packagePath).mtime.toISOString().slice(0, 10),
      hot: true,
      matchBridge: false,
      detailHtml: `<section><h3>About ${siteName}</h3><p>${primaryDescription}</p></section>`,
      ...inferredAttributes({ title: siteName, description: primaryDescription }, filterConfiguration),
    });
    makeIssue(
      issues,
      "info",
      "homepage_game_synthesized",
      `The homepage game ${siteName} was not present in config/games.ts, so the primary game record was generated automatically.`,
      { gameId: siteId },
    );
  }
  const primary = pickPrimaryGame(extractedGames, siteId, siteName, rootData.gameUrl);
  if (primary && rootData.gameUrl) primary.playUrl = rootData.gameUrl;
  const excludedGameIds = extractedGames
    .filter((game) => RANKING_EXCLUSIONS.some((token) => game.id.includes(token)))
    .map((game) => game.id);
  const visibleGames = extractedGames.filter((game) => !excludedGameIds.includes(game.id));
  const faqItems = parseFaq(resolvedTarget);
  if (!faqItems.length) {
    makeIssue(issues, "warning", "faq_not_extracted", "No static FAQ array was found; generic FAQ items were generated.");
  }
  if (!rootData.videoId) {
    makeIssue(issues, "warning", "youtube_review_required", "No homepage YouTube video ID was found; the placeholder must be reviewed before migration.");
  }
  makeIssue(
    issues,
    "info",
    "attributes_inferred",
    "Game attributes were inferred automatically from legacy titles and descriptions; they can be refined after migration testing.",
  );
  makeIssue(
    issues,
    "info",
    "legacy_metrics_reset",
    "Legacy plays, ratings, favorites and likes were intentionally reset instead of importing seeded or unverifiable values.",
  );
  const baseRoutes = baseBlueprint.routes || {};
  const categoryId = slug(category.id || `${siteId}-games`);
  const categoryPath = text(category.path) || `/${categoryId}`;
  const seoDescription = metadata.description || text(category.description) || `Play ${siteName} and related browser games online for free.`;
  const logo = metadata.logo || primary?.image || "/favicon.ico";
  const rawBlueprint = {
    schemaVersion: 1,
    site: {
      id: siteId,
      name: siteName,
      brandName: domain || siteName,
      domain,
      email: baseBlueprint.site.email,
      timeZone: baseBlueprint.site.timeZone || "America/New_York",
      primaryGameId: primary?.id,
      legalLastUpdated: baseBlueprint.site.legalLastUpdated || today,
      assets: {
        gameOrigin: inferredGameOrigin(domain, extractedGames),
        logo,
        navigationLogo: logo,
        favicon: metadata.favicon,
      },
      seo: {
        title: metadata.title || `${siteName} - Play Online for Free!`,
        description: seoDescription,
        keywords: metadata.keywords.length ? metadata.keywords : [siteName.toLowerCase()],
        twitterCreator: metadata.twitterCreator,
      },
      footerGameIds: visibleGames.slice(0, 3).map((game) => game.id),
      feedbackProjectKey: "",
    },
    routes: {
      categoryPath,
      filterPath: baseRoutes.filterPath || "/game-filters",
      filterLabel: baseRoutes.filterLabel || "Game Filters",
    },
    category: {
      id: categoryId,
      title: text(category.title) || `${siteName} Games`,
      heading: text(category.title) || `${siteName} Games`,
      description: text(category.description) || seoDescription,
      metadataTitle: `${text(category.title) || `${siteName} Games`} - Play Online`,
      metadataDescription: text(category.description) || seoDescription,
      socialDescription: text(category.description) || seoDescription,
      keywords: metadata.keywords.join(", ") || `${siteName.toLowerCase()} games`,
    },
    filters: filterConfiguration,
    games: extractedGames,
    home: {
      backgroundImage: primary?.coverImage || logo,
      coverTagline: compactSentence(primary?.description, `Play ${siteName} online for free.`),
      relatedGameIds: visibleGames.filter((game) => game.id !== primary?.id).slice(0, 6).map((game) => game.id),
      structuredImageCaption: `${siteName} game icon`,
      descriptionHtml: primary?.detailHtml || `<section><h3>About ${siteName}</h3><p>${seoDescription}</p></section>`,
      heroAlt: `${siteName} gameplay`,
      youtube: {
        videoId: rootData.videoId || "pending-review",
        title: rootData.videoTitle || `${siteName} Gameplay`,
        description: rootData.videoDescription || `Watch ${siteName} gameplay and learn the basics.`,
      },
      faqItems: faqItems.length ? faqItems : [
        { question: `How do I play ${siteName}?`, answer: `Select Play now to open ${siteName} in your browser. No separate installer is required.` },
        { question: `Is ${siteName} free to play?`, answer: `${siteName} can be played online through this browser game website.` },
      ],
    },
    hotGames: {
      heading: "Hot Games",
      description: "Browse the games receiving the most real play activity.",
      limit: Math.min(21, extractedGames.length),
    },
    filterPage: {
      ...baseBlueprint.filterPage,
      heading: baseRoutes.filterLabel || "Game Filters",
      filteredHeadingSuffix: baseRoutes.filterLabel || "Game Filters",
    },
    cloudflare: {
      accountId: "",
      pagesProject: siteId,
      productionBranch: "main",
      database: { binding: "DB", name: siteId, id: "", previewId: "", location: "enam" },
    },
    competition: {
      adapterId: baseBlueprint.competition?.adapterId || "1v1-lol",
    },
    ranking: { excludedGameIds },
    features: baseBlueprint.features || {},
    theme: baseBlueprint.theme || {},
  };

  let blueprint = null;
  try {
    blueprint = toEditableSiteBlueprint(
      normalizeSiteBlueprint(rawBlueprint, { root: resolvedTemplate, today }),
    );
  } catch (error) {
    makeIssue(
      issues,
      "blocker",
      "blueprint_validation_failed",
      error instanceof Error ? error.message : String(error),
    );
  }
  const legacyRoutes = discoverLegacyRoutes(resolvedTarget);
  const redirects = legacyRedirects(legacyRoutes);
  const preservedRoutes = new Set([
    "/",
    "/hot-games",
    "/about-us",
    "/contact-us",
    "/terms-of-service",
    "/privacy-policy",
    "/dmca",
    categoryPath,
    ...extractedGames.map((game) => `${categoryPath}/${game.id}`),
  ]);
  const redirectedRoutes = new Set(redirects.map((item) => item.from));
  const unmappedLegacyRoutes = legacyRoutes.filter(
    (routeValue) => !preservedRoutes.has(routeValue) && !redirectedRoutes.has(routeValue),
  );
  if (unmappedLegacyRoutes.length) {
    makeIssue(
      issues,
      "warning",
      "unmapped_legacy_routes",
      `${unmappedLegacyRoutes.length} legacy route(s) require a redirect or explicit content decision.`,
    );
  }
  const counts = Object.fromEntries(
    ["blocker", "warning", "info"].map((severity) => [
      severity,
      issues.filter((issue) => issue.severity === severity).length,
    ]),
  );
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    targetRoot: resolvedTarget,
    baseBlueprintPath: path.resolve(baseBlueprintPath),
    status: counts.blocker ? "blocked" : counts.warning ? "review" : "ready",
    site: {
      id: siteId,
      name: siteName,
      domain,
      categoryId,
      primaryGameId: primary?.id || null,
    },
    counts: {
      categories: categories.length,
      games: extractedGames.length,
      legacyRoutes: legacyRoutes.length,
      unmappedLegacyRoutes: unmappedLegacyRoutes.length,
      blockers: counts.blocker,
      warnings: counts.warning,
      information: counts.info,
    },
    routeAudit: {
      legacyRoutes,
      preservedRoutes: [...preservedRoutes].sort(),
      redirects,
      unmappedLegacyRoutes,
    },
    issues,
  };
  return { blueprint, report };
}
