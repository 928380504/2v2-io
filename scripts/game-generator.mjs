import fs from "node:fs";
import path from "node:path";

export const GAME_CATALOG_INSERTION_MARKER =
  "  // game:add insertion point; keep this line.";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ATTRIBUTE_KEY = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const JSON_KEY_ALIASES = {
  categoryId: "category",
  playUrl: "play-url",
  coverImage: "cover-image",
  coverAlt: "cover-alt",
  metadataDescription: "meta-description",
  playerModes: "player-modes",
  loadSpeed: "load-speed",
  siteAddedAt: "site-added-at",
  createdAt: "created-at",
  matchBridge: "match-bridge",
  youtubeId: "youtube-id",
  youtubeTitle: "youtube-title",
  youtubeDescription: "youtube-description"
};

export function parseArguments(values) {
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

export function normalizeJsonKeys(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Every imported game must be a JSON object.");
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [JSON_KEY_ALIASES[key] || key, item])
  );
}

function requireText(value, label, maximumLength) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(`${label} is required.`);
  if (normalized.length > maximumLength) {
    throw new Error(`${label} must not exceed ${maximumLength} characters.`);
  }
  return normalized;
}

function slug(value, label) {
  const normalized = requireText(value, label, 64).toLowerCase();
  if (!SLUG.test(normalized)) {
    throw new Error(`${label} must use lowercase letters, numbers and single hyphens only.`);
  }
  return normalized;
}

function commaList(value, fallback = []) {
  if (value === undefined || value === null || value === "") return [...fallback];
  const values = String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return [...new Set(values)];
}

function enumList(value, label, allowed, fallback) {
  const values = commaList(value, fallback);
  const invalid = values.filter((item) => !allowed.has(item));
  if (invalid.length) {
    throw new Error(`${label} contains unsupported value(s): ${invalid.join(", ")}.`);
  }
  return values;
}

function normalizeFilterConfiguration(configuration) {
  if (!configuration || configuration.schemaVersion !== 1) {
    throw new Error("site/game-filters.json must use schemaVersion 1.");
  }
  if (!Array.isArray(configuration.groups) || configuration.groups.length === 0) {
    throw new Error("site/game-filters.json must define at least one filter group.");
  }
  const groupKeys = new Set();
  const attributeKeys = new Set();
  const generatorKeys = new Set();
  const optionSlugs = new Set();
  const groups = configuration.groups.map((group, index) => {
    const label = `site/game-filters.json groups[${index}]`;
    const key = slug(group.key, `${label}.key`);
    const generatorKey = slug(group.generatorKey, `${label}.generatorKey`);
    const attributeKey = requireText(group.attributeKey, `${label}.attributeKey`, 64);
    if (!ATTRIBUTE_KEY.test(attributeKey)) {
      throw new Error(`${label}.attributeKey must be a valid JavaScript property name.`);
    }
    if (groupKeys.has(key) || attributeKeys.has(attributeKey) || generatorKeys.has(generatorKey)) {
      throw new Error(`${label} repeats a group, attribute or generator key.`);
    }
    groupKeys.add(key);
    attributeKeys.add(attributeKey);
    generatorKeys.add(generatorKey);
    if (!Array.isArray(group.options) || group.options.length === 0) {
      throw new Error(`${label}.options must contain at least one option.`);
    }
    const options = group.options.map((option, optionIndex) => {
      const optionSlug = slug(option.slug, `${label}.options[${optionIndex}].slug`);
      if (optionSlugs.has(optionSlug)) {
        throw new Error(`Filter option slug must be globally unique: ${optionSlug}.`);
      }
      optionSlugs.add(optionSlug);
      return {
        slug: optionSlug,
        label: requireText(option.label, `${label}.options[${optionIndex}].label`, 80)
      };
    });
    const allowed = new Set(options.map((option) => option.slug));
    const fallback = enumList(
      group.generatorDefaultValues,
      `${label}.generatorDefaultValues`,
      allowed,
      []
    );
    if (group.multiple === false && fallback.length > 1) {
      throw new Error(`${label}.generatorDefaultValues may contain only one value.`);
    }
    return {
      key,
      attributeKey,
      generatorKey,
      multiple: group.multiple !== false,
      options,
      allowed,
      fallback
    };
  });
  if (!groupKeys.has(configuration.primaryMatchGroup)) {
    throw new Error("primaryMatchGroup must reference an existing filter group.");
  }
  return { groups, primaryMatchGroup: configuration.primaryMatchGroup };
}

function dateValue(value, label, fallback) {
  if (!value) return fallback;
  const normalized = String(value).trim();
  if (!ISO_DATE.test(normalized) || Number.isNaN(Date.parse(`${normalized}T00:00:00Z`))) {
    throw new Error(`${label} must use a valid YYYY-MM-DD date.`);
  }
  return normalized;
}

function nonNegativeNumber(value, label, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized < 0) {
    throw new Error(`${label} must be a non-negative number.`);
  }
  return normalized;
}

function ratingValue(value) {
  if (value === undefined || value === null || value === "") return null;
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized < 0 || normalized > 5) {
    throw new Error("--rating must be a number from 0 to 5.");
  }
  return normalized;
}

function assetExpression(value) {
  const normalized = String(value).trim();
  if (/^https?:\/\//i.test(normalized) || normalized.startsWith("/")) {
    return JSON.stringify(normalized);
  }
  return `gameAssetUrl(${JSON.stringify(normalized.replace(/^\/+/, ""))})`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("`", "&#96;")
    .replaceAll("${", "&#36;{");
}

function sourceArray(values) {
  return `[${values.map((value) => JSON.stringify(value)).join(", ")}]`;
}

export function normalizeGameOptions(rawOptions, defaults = {}) {
  const id = slug(rawOptions.id, "--id");
  const title = requireText(rawOptions.title, "--title", 80);
  const description = requireText(rawOptions.description, "--description", 500);
  if (description.length < 40) {
    throw new Error("--description must contain at least 40 characters for a useful game page.");
  }
  const categoryId = slug(
    rawOptions.category || defaults.primaryCategoryId,
    "--category"
  );
  const filterConfiguration = normalizeFilterConfiguration(defaults.filterConfig);
  const attributeEntries = filterConfiguration.groups.map((group) => {
    const suppliedValue =
      rawOptions[group.generatorKey] ??
      rawOptions[group.key] ??
      rawOptions[group.attributeKey];
    const values = enumList(
      suppliedValue,
      `--${group.generatorKey}`,
      group.allowed,
      group.fallback
    );
    if (!group.multiple && values.length !== 1) {
      throw new Error(`--${group.generatorKey} must contain exactly one value.`);
    }
    return {
      key: group.key,
      attributeKey: group.attributeKey,
      generatorKey: group.generatorKey,
      multiple: group.multiple,
      values
    };
  });
  const primaryGroup = filterConfiguration.groups.find(
    (group) => group.key === filterConfiguration.primaryMatchGroup
  );
  const primaryEntry = attributeEntries.find(
    (entry) => entry.key === filterConfiguration.primaryMatchGroup
  );
  const tags = commaList(
    rawOptions.tags,
    (primaryEntry?.values || []).map(
      (value) => primaryGroup?.options.find((option) => option.slug === value)?.label
    ).filter(Boolean)
  );
  const today = defaults.today || new Date().toISOString().slice(0, 10);
  const baseAssetPath = `${categoryId}/${id}`;

  return {
    id,
    categoryId,
    title,
    description,
    metadataDescription: requireText(
      rawOptions["meta-description"] || description,
      "--meta-description",
      320
    ),
    image: rawOptions.image || `${baseAssetPath}/${id}-logo.webp`,
    playUrl: rawOptions["play-url"] || `${baseAssetPath}/index.html`,
    coverImage: rawOptions["cover-image"] || `${baseAssetPath}/${id}-bj.webp`,
    coverAlt: requireText(
      rawOptions["cover-alt"] || `${title} Background`,
      "--cover-alt",
      160
    ),
    developer: requireText(
      rawOptions.developer || "Independent Studio",
      "--developer",
      120
    ),
    technology: requireText(rawOptions.technology || "HTML5", "--technology", 80),
    platforms: commaList(rawOptions.platforms, ["Web Browser"]),
    tags,
    plays: nonNegativeNumber(rawOptions.plays, "--plays"),
    rating: ratingValue(rawOptions.rating),
    ratingCount: nonNegativeNumber(rawOptions.ratingCount, "--rating-count"),
    favorites: nonNegativeNumber(rawOptions.favorites, "--favorites"),
    likes: nonNegativeNumber(rawOptions.likes, "--likes"),
    attributeEntries,
    siteAddedAt: dateValue(rawOptions["site-added-at"], "--site-added-at", today),
    createdAt: rawOptions["created-at"]
      ? dateValue(rawOptions["created-at"], "--created-at")
      : null,
    isHot: rawOptions.hot === true || rawOptions.hot === "true",
    matchBridge:
      rawOptions["match-bridge"] === true || rawOptions["match-bridge"] === "true",
    youtubeId: rawOptions["youtube-id"]
      ? requireText(rawOptions["youtube-id"], "--youtube-id", 32)
      : null,
    youtubeTitle: rawOptions["youtube-title"] || `${title} Gameplay`,
    youtubeDescription:
      rawOptions["youtube-description"] || `Watch ${title} gameplay and learn the basics.`,
    detailHtml: rawOptions.detailHtml
      ? requireText(rawOptions.detailHtml, "--detail-html", 40000)
      : null,
  };
}

export function buildGameDefinition(game) {
  const safeTitle = escapeHtml(game.title);
  const safeDescription = escapeHtml(game.description);
  const lines = [
    `  ${JSON.stringify(game.id)}: {`,
    `    categoryId: ${JSON.stringify(game.categoryId)},`,
    `    title: ${JSON.stringify(game.title)},`,
    `    image: ${assetExpression(game.image)},`,
    `    plays: ${game.plays},`,
    `    tags: ${sourceArray(game.tags)},`,
    "    gameAttributes: {",
    ...game.attributeEntries.map((entry) =>
      `      ${entry.attributeKey}: ${
        entry.multiple ? sourceArray(entry.values) : JSON.stringify(entry.values[0])
      },`
    ),
    "    },",
    `    developer: ${JSON.stringify(game.developer)},`,
    `    technology: ${JSON.stringify(game.technology)},`,
    `    platforms: ${sourceArray(game.platforms)},`,
    `    description: ${JSON.stringify(game.description)},`
  ];
  if (game.rating !== null) lines.push(`    rating: ${game.rating},`);
  if (game.ratingCount) lines.push(`    ratingCount: ${game.ratingCount},`);
  if (game.favorites) lines.push(`    favorites: ${game.favorites},`);
  if (game.likes) lines.push(`    likes: ${game.likes},`);
  if (game.createdAt) lines.push(`    createdAt: ${JSON.stringify(game.createdAt)},`);
  lines.push(`    siteAddedAt: ${JSON.stringify(game.siteAddedAt)},`);
  if (game.isHot) lines.push("    isHot: true,");
  if (game.matchBridge) lines.push("    matchBridge: true,");
  lines.push(
    "    detail: {",
    `      playUrl: ${assetExpression(game.playUrl)},`,
    `      coverImage: ${assetExpression(game.coverImage)},`,
    `      coverAlt: ${JSON.stringify(game.coverAlt)},`,
    `      metadataDescription: ${JSON.stringify(game.metadataDescription)},`
  );
  if (game.youtubeId) {
    lines.push(
      "      youtube: {",
      `        videoId: ${JSON.stringify(game.youtubeId)},`,
      `        title: ${JSON.stringify(game.youtubeTitle)},`,
      `        description: ${JSON.stringify(game.youtubeDescription)},`,
      "      },"
    );
  }
  if (game.detailHtml) {
    lines.push(`      description: ${JSON.stringify(game.detailHtml)},`);
  } else {
    lines.push(
      "      description: `",
      "        <section class=\"mb-12\">",
      `          <h3 class=\"text-2xl font-bold text-gray-900 dark:text-white mb-4\">About ${safeTitle}</h3>`,
      `          <p class=\"text-gray-700 dark:text-gray-300\">${safeDescription}</p>`,
      "        </section>",
      "      `,"
    );
  }
  lines.push("    },", "  },");
  return lines.join("\n");
}

export function insertGameDefinition(catalogSource, gameId, definitionSource) {
  const escapedId = gameId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(`^\\s{2}["']${escapedId}["']\\s*:`, "m").test(catalogSource)) {
    throw new Error(`Game ID already exists: ${gameId}`);
  }
  if (!catalogSource.includes(GAME_CATALOG_INSERTION_MARKER)) {
    throw new Error("The game catalog insertion marker is missing.");
  }
  return catalogSource.replace(
    GAME_CATALOG_INSERTION_MARKER,
    `${definitionSource}\n${GAME_CATALOG_INSERTION_MARKER}`
  );
}

export function applyCatalogChange({
  catalogPath,
  backupPath,
  nextCatalog,
  validate
}) {
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  fs.copyFileSync(catalogPath, backupPath);
  fs.writeFileSync(catalogPath, nextCatalog, "utf8");
  try {
    validate();
  } catch (error) {
    fs.copyFileSync(backupPath, catalogPath);
    throw error;
  }
}
