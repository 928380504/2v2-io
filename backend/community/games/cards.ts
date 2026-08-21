import { requireDatabase } from "../../core/database";
import {
  ApiError,
  cachedJson,
  errorResponse,
  optionsResponse
} from "../../core/http";

const GAME_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
const MAXIMUM_GAME_IDS = 50;

interface EngagementRow {
  game_id: string;
  play_count: number;
  like_count: number;
  favorite_count: number;
}

function parseGameIds(value: string | null) {
  if (!value) {
    throw new ApiError(400, "missing_game_ids", "gameIds is required.");
  }

  const gameIds = Array.from(
    new Set(
      value
        .split(",")
        .map((gameId) => gameId.trim().toLowerCase())
        .filter(Boolean)
    )
  ).sort();

  if (gameIds.length === 0 || gameIds.length > MAXIMUM_GAME_IDS) {
    throw new ApiError(
      400,
      "invalid_game_ids",
      `gameIds must contain from 1 to ${MAXIMUM_GAME_IDS} unique games.`
    );
  }

  const invalidGameId = gameIds.find((gameId) => !GAME_ID_PATTERN.test(gameId));
  if (invalidGameId) {
    throw new ApiError(400, "invalid_game_id", `Invalid gameId: ${invalidGameId}`);
  }

  return gameIds;
}

function normalizeCount(value: unknown) {
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}

export const onRequestOptions: PagesFunction = async () => optionsResponse();

export const onRequestGet: PagesFunction = async (context) => {
  try {
    const database = requireDatabase(context.env);
    const url = new URL(context.request.url);
    const gameIds = parseGameIds(url.searchParams.get("gameIds"));
    const placeholders = gameIds.map((_, index) => `?${index + 1}`).join(", ");

    const engagementResult = await database.prepare(`
      SELECT game_id, play_count, like_count, favorite_count
      FROM game_engagement_stats
      WHERE game_id IN (${placeholders})
    `).bind(...gameIds).all<EngagementRow>();

    const engagementByGame = new Map(
      (engagementResult.results || []).map((row) => [row.game_id, row])
    );
    return cachedJson({
      ok: true,
      items: gameIds.map((gameId) => {
        const engagement = engagementByGame.get(gameId);

        return {
          gameId,
          plays: normalizeCount(engagement?.play_count),
          likes: normalizeCount(engagement?.like_count),
          favorites: normalizeCount(engagement?.favorite_count)
        };
      })
    }, 300, 900);
  } catch (error) {
    return errorResponse(error);
  }
};
