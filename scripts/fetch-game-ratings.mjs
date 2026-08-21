import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const gamesPath = path.join(
  projectRoot,
  "site",
  "content",
  "game-catalog-data.ts",
);
const siteManifestPath = path.join(projectRoot, "site", "manifest.json");
const outputPath = path.join(
  projectRoot,
  "site",
  "generated",
  "ratings.generated.json",
);
function readConfiguredSiteOrigin() {
  try {
    const manifest = JSON.parse(fs.readFileSync(siteManifestPath, "utf8"));
    return typeof manifest?.site?.url === "string" ? manifest.site.url : "";
  } catch {
    return "";
  }
}

const apiOrigin = (
  process.env.RATINGS_API_ORIGIN || readConfiguredSiteOrigin()
).replace(/\/$/, "");
const maximumBatchSize = 50;

function readGameIds() {
  const source = fs.readFileSync(gamesPath, "utf8");
  return Array.from(
    new Set(
      Array.from(source.matchAll(/^\s{2}"([a-z0-9][a-z0-9-]{0,63})"\s*:\s*\{/gim))
        .map((match) => match[1].toLowerCase()),
    ),
  ).sort();
}

function readExistingSnapshot() {
  try {
    const value = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    return value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};
  } catch {
    return {};
  }
}

function normalizeItem(item) {
  const score = Number(item?.score);
  const votes = Number(item?.votes);
  if (
    typeof item?.gameId !== "string" ||
    !Number.isFinite(score) ||
    score < 0 ||
    score > 5 ||
    !Number.isInteger(votes) ||
    votes < 0
  ) return null;

  return {
    gameId: item.gameId.toLowerCase(),
    score,
    votes,
  };
}

async function fetchBatch(gameIds) {
  const query = encodeURIComponent(gameIds.join(","));
  const response = await fetch(
    `${apiOrigin}/api/comments/ratings?gameIds=${query}`,
    {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) {
    throw new Error(`Ratings API returned ${response.status}`);
  }
  const payload = await response.json();
  if (!payload?.ok || !Array.isArray(payload.items)) {
    throw new Error("Ratings API returned an invalid response");
  }
  return payload.items.map(normalizeItem).filter(Boolean);
}

function writeSnapshot(snapshot) {
  const serialized = `${JSON.stringify(snapshot, null, 2)}\n`;
  const existing = fs.existsSync(outputPath)
    ? fs.readFileSync(outputPath, "utf8")
    : "";
  if (existing === serialized) return false;
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, serialized);
  return true;
}

async function main() {
  const gameIds = readGameIds();
  if (gameIds.length === 0) {
    throw new Error("No game IDs were found in site/content/game-catalog-data.ts");
  }
  if (!apiOrigin) {
    throw new Error("No ratings API origin is configured");
  }

  const nextSnapshot = {};
  for (let index = 0; index < gameIds.length; index += maximumBatchSize) {
    const batch = gameIds.slice(index, index + maximumBatchSize);
    const items = await fetchBatch(batch);
    const byGameId = new Map(items.map((item) => [item.gameId, item]));
    batch.forEach((gameId) => {
      const item = byGameId.get(gameId);
      nextSnapshot[gameId] = {
        score: item?.score ?? 0,
        votes: item?.votes ?? 0,
      };
    });
  }

  const changed = writeSnapshot(nextSnapshot);
  console.log(
    `Rating snapshot ${changed ? "updated" : "unchanged"}: ${gameIds.length} games`,
  );
}

main().catch((error) => {
  const existing = readExistingSnapshot();
  if (Object.keys(existing).length > 0) {
    console.warn(
      `Rating snapshot refresh failed; using the existing snapshot: ${error.message}`,
    );
    return;
  }
  console.error(error);
  process.exitCode = 1;
});
