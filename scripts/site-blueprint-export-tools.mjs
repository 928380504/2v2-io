import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { normalizeSiteBlueprint, toEditableSiteBlueprint } from "./site-creator-tools.mjs";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
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

function propertyName(node, evaluate) {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return node.text;
  if (ts.isComputedPropertyName(node)) return String(evaluate(node.expression));
  throw new Error(`Unsupported property name: ${node.getText()}`);
}

export function evaluateTypeScriptLiteral(source, exportName, environment = {}, fileName = "site-value.ts") {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const declarations = new Map();
  sourceFile.forEachChild((node) => {
    if (!ts.isVariableStatement(node)) return;
    node.declarationList.declarations.forEach((declaration) => {
      if (ts.isIdentifier(declaration.name) && declaration.initializer) {
        declarations.set(declaration.name.text, declaration.initializer);
      }
    });
  });
  const resolving = new Set();
  const evaluate = (input) => {
    const node = unwrap(input);
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    if (ts.isNumericLiteral(node)) return Number(node.text);
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (node.kind === ts.SyntaxKind.NullKeyword) return null;
    if (ts.isIdentifier(node)) {
      if (node.text === "undefined") return undefined;
      if (Object.prototype.hasOwnProperty.call(environment, node.text)) return environment[node.text];
      const declaration = declarations.get(node.text);
      if (!declaration) throw new Error(`Unresolved identifier ${node.text} in ${fileName}.`);
      if (resolving.has(node.text)) throw new Error(`Circular literal reference ${node.text} in ${fileName}.`);
      resolving.add(node.text);
      try {
        return evaluate(declaration);
      } finally {
        resolving.delete(node.text);
      }
    }
    if (ts.isPropertyAccessExpression(node)) {
      const owner = evaluate(node.expression);
      if (owner === null || owner === undefined) throw new Error(`Cannot read ${node.name.text} in ${fileName}.`);
      return owner[node.name.text];
    }
    if (ts.isElementAccessExpression(node)) {
      const owner = evaluate(node.expression);
      return owner[evaluate(node.argumentExpression)];
    }
    if (ts.isArrayLiteralExpression(node)) {
      return node.elements.map((element) => evaluate(element));
    }
    if (ts.isObjectLiteralExpression(node)) {
      const value = {};
      node.properties.forEach((property) => {
        if (ts.isPropertyAssignment(property)) {
          value[propertyName(property.name, evaluate)] = evaluate(property.initializer);
        } else if (ts.isShorthandPropertyAssignment(property)) {
          value[property.name.text] = evaluate(property.name);
        } else if (ts.isSpreadAssignment(property)) {
          Object.assign(value, evaluate(property.expression));
        } else {
          throw new Error(`Unsupported object member in ${fileName}: ${property.getText()}`);
        }
      });
      return value;
    }
    if (ts.isTemplateExpression(node)) {
      return node.templateSpans.reduce(
        (result, span) => result + String(evaluate(span.expression)) + span.literal.text,
        node.head.text,
      );
    }
    if (ts.isCallExpression(node)) {
      if (ts.isIdentifier(node.expression) && node.expression.text === "gameAssetUrl") {
        return evaluate(node.arguments[0]);
      }
      throw new Error(`Unsupported call in ${fileName}: ${node.expression.getText()}`);
    }
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "Set") {
      return evaluate(node.arguments?.[0] || ts.factory.createArrayLiteralExpression());
    }
    if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken) {
      return -Number(evaluate(node.operand));
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      return evaluate(node.left) + evaluate(node.right);
    }
    throw new Error(`Unsupported literal syntax in ${fileName}: ${node.getText()}`);
  };
  const initializer = declarations.get(exportName);
  if (!initializer) throw new Error(`Exported value ${exportName} was not found in ${fileName}.`);
  return evaluate(initializer);
}

function readSiteLiteral(root, relativePath, exportName, environment) {
  const filePath = path.join(root, ...relativePath.split("/"));
  return evaluateTypeScriptLiteral(fs.readFileSync(filePath, "utf8"), exportName, environment, relativePath);
}

function exportGame(id, definition, filters) {
  const detail = definition.detail || {};
  const game = {
    id,
    categoryId: definition.categoryId,
    title: definition.title,
    description: definition.description,
    metadataDescription: detail.metadataDescription || definition.description,
    image: definition.image,
    playUrl: detail.playUrl,
    coverImage: detail.coverImage,
    coverAlt: detail.coverAlt || `${definition.title} Background`,
    developer: definition.developer || "Independent Studio",
    technology: definition.technology || "HTML5",
    platforms: definition.platforms || ["Web Browser"],
    tags: definition.tags || [],
    plays: definition.plays || 0,
    rating: definition.rating,
    ratingCount: definition.ratingCount || 0,
    favorites: definition.favorites || 0,
    likes: definition.likes || 0,
    createdAt: definition.createdAt,
    siteAddedAt: definition.siteAddedAt,
    hot: definition.isHot === true,
    matchBridge: definition.matchBridge === true,
    detailHtml: detail.description,
  };
  for (const group of filters.groups) {
    const current = definition.gameAttributes?.[group.attributeKey];
    if (current !== undefined) game[group.attributeKey] = current;
  }
  if (detail.youtube) {
    game.youtubeId = detail.youtube.videoId;
    game.youtubeTitle = detail.youtube.title;
    game.youtubeDescription = detail.youtube.description;
  }
  return Object.fromEntries(Object.entries(game).filter(([, value]) => value !== undefined));
}

export function exportCurrentSiteBlueprint(root) {
  const manifest = readJson(path.join(root, "site", "manifest.json"));
  const filters = readJson(path.join(root, "site", "game-filters.json"));
  const cloudflare = readJson(path.join(root, "site", "cloudflare.json"));
  const environment = {
    SITE_CONFIG: manifest.site,
    SITE_ROUTES: manifest.routes,
  };
  const categories = readSiteLiteral(root, "site/content/game-categories.ts", "GAME_CATEGORY_DEFINITIONS", environment);
  const categoryPages = readSiteLiteral(root, "site/content/category-pages.ts", "CATEGORY_PAGES", environment);
  const categoryId = manifest.site.primaryCategoryId;
  const categoryIdentity = categories[categoryId];
  const categoryPage = Object.values(categoryPages).find((page) => page?.categoryId === categoryId);
  if (!categoryIdentity || !categoryPage) throw new Error(`Primary category ${categoryId} could not be exported.`);
  const homePage = readSiteLiteral(root, "site/content/home-page.ts", "HOME_PAGE", environment);
  const hotGames = readSiteLiteral(root, "site/content/hot-games-page.ts", "HOT_GAMES_PAGE", environment);
  const filterPage = readSiteLiteral(root, "site/content/game-filters-page.ts", "GAME_FILTERS_PAGE", environment);
  const definitions = readSiteLiteral(root, "site/content/game-catalog-data.ts", "GAME_DEFINITIONS", environment);
  const excludedGameIds = readSiteLiteral(root, "site/content/popular-games.ts", "gameRankingExcludedIds", environment);
  const legalPages = readSiteLiteral(root, "site/content/legal-pages.ts", "LEGAL_PAGES", environment);
  const aboutUs = readSiteLiteral(root, "site/content/legal-pages.ts", "ABOUT_US_CONTENT", environment);
  const backendSource = fs.readFileSync(path.join(root, "site", "backend.ts"), "utf8");
  const adapterId = backendSource.match(/competitionAdapterId:\s*["']([^"']+)["']/)?.[1];
  if (!adapterId) throw new Error("site/backend.ts does not declare competitionAdapterId.");
  const raw = {
    schemaVersion: 1,
    site: {
      id: manifest.site.id,
      name: manifest.site.name,
      brandName: manifest.site.brandName,
      domain: manifest.site.domain,
      email: manifest.site.email,
      timeZone: manifest.site.timeZone,
      primaryGameId: manifest.site.primaryGameId,
      legalLastUpdated: manifest.site.legalLastUpdated,
      assets: manifest.site.assets,
      seo: manifest.site.seo,
      footerGameIds: manifest.site.footer?.gameIds || [],
      feedbackProjectKey: manifest.site.integrations?.makeThisBetterProjectKey || "",
    },
    routes: {
      categoryPath: manifest.routes.gameCategory,
      filterPath: manifest.routes.gameFilters,
      filterLabel: filterPage.heading,
    },
    category: {
      id: categoryId,
      title: categoryIdentity.title,
      catalogDescription: categoryIdentity.description,
      heading: categoryPage.heading,
      description: categoryPage.description,
      metadataTitle: categoryPage.metadataTitle,
      metadataDescription: categoryPage.metadataDescription,
      socialDescription: categoryPage.socialDescription,
      keywords: categoryPage.keywords,
    },
    filters,
    games: Object.entries(definitions).map(([id, definition]) => exportGame(id, definition, filters)),
    home: {
      backgroundImage: homePage.player.backgroundImage,
      coverTagline: homePage.player.coverTagline,
      relatedGameIds: homePage.player.relatedGameIds,
      structuredImageCaption: homePage.structuredImageCaption,
      descriptionHtml: homePage.article.description,
      heroAlt: homePage.article.heroAlt,
      youtube: homePage.article.youtube,
      faqItems: homePage.article.faqItems,
    },
    hotGames: {
      heading: hotGames.heading,
      description: hotGames.description,
      metadataTitle: hotGames.metadataTitle,
      metadataDescription: hotGames.metadataDescription,
      socialDescription: hotGames.socialDescription,
      keywords: hotGames.keywords,
    },
    filterPage: {
      heading: filterPage.heading,
      filteredHeadingSuffix: filterPage.filteredHeadingSuffix,
      description: filterPage.description,
      resultNoun: filterPage.resultNoun,
      metadataTitle: filterPage.metadataTitle,
      metadataDescription: filterPage.metadataDescription,
      attributesTitle: filterPage.attributesTitle,
      attributesDescription: filterPage.attributesDescription,
      resultsTitle: filterPage.resultsTitle,
      emptyTitle: filterPage.emptyTitle,
      clearLabel: filterPage.clearLabel,
      clearAllLabel: filterPage.clearAllLabel,
      legacyMessage: filterPage.legacyMessage,
      legacyLinkLabel: filterPage.legacyLinkLabel,
      legacyMetadataTitle: filterPage.legacyMetadataTitle,
      legacyMetadataDescription: filterPage.legacyMetadataDescription,
    },
    cloudflare: {
      accountId: cloudflare.accountId,
      pagesProject: cloudflare.pagesProject,
      productionBranch: cloudflare.productionBranch,
      database: cloudflare.database,
    },
    competition: { adapterId },
    ranking: { excludedGameIds },
    legal: { pages: legalPages, aboutUs },
    features: manifest.features,
    theme: manifest.theme,
  };
  return toEditableSiteBlueprint(normalizeSiteBlueprint(raw, { root }));
}

export function buildBlueprintExportPlan(root) {
  const blueprint = exportCurrentSiteBlueprint(root);
  const targetPath = path.join(root, "site", "blueprint.json");
  const contents = `${JSON.stringify(blueprint, null, 2)}\n`;
  const current = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, "utf8") : null;
  return { blueprint, targetPath, contents, status: current === contents ? "current" : "ready", exists: current !== null };
}

export function applyBlueprintExportPlan(root, plan, { now = new Date() } = {}) {
  if (plan.status !== "ready") throw new Error(`site:export cannot apply while status is ${plan.status}.`);
  let backupPath = null;
  if (plan.exists) {
    const timestamp = now.toISOString().replace(/[:.]/g, "-");
    backupPath = path.join(root, "backups", "site-export", timestamp, "site", "blueprint.json");
    fs.mkdirSync(path.dirname(backupPath), { recursive: true });
    fs.copyFileSync(plan.targetPath, backupPath);
  }
  const temporaryPath = `${plan.targetPath}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, plan.contents);
    fs.renameSync(temporaryPath, plan.targetPath);
  } finally {
    if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
  }
  return { targetPath: plan.targetPath, backupPath };
}
