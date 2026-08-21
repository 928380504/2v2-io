import { requireDatabase } from "../../core/database";
import {
  ApiError,
  cachedJson,
  errorResponse,
  optionsResponse
} from "../../core/http";

const GAME_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
const MAXIMUM_GAME_IDS = 50;

interface RatingRow {
  game_id: string;
  rating_sum: number;
  rating_count: number;
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

export const onRequestOptions: PagesFunction = async () => optionsResponse();

export const onRequestGet: PagesFunction = async (context) => {
  try {
    const database = requireDatabase(context.env);
    const url = new URL(context.request.url);
    const gameIds = parseGameIds(url.searchParams.get("gameIds"));
    const placeholders = gameIds.map((_, index) => `?${index + 1}`).join(", ");
    const result = await database.prepare(`
      SELECT game_id, rating_sum, rating_count
      FROM comment_game_stats
      WHERE game_id IN (${placeholders})
        AND rating_count > 0
    `).bind(...gameIds).all<RatingRow>();
    const ratingsByGame = new Map(
      (result.results || []).map((row) => [row.game_id, row])
    );

    return cachedJson({
      ok: true,
      items: gameIds.map((gameId) => {
        const row = ratingsByGame.get(gameId);
        const votes = Number(row?.rating_count || 0);
        return {
          gameId,
          score: votes > 0 ? Number(row?.rating_sum || 0) / votes : 0,
          votes
        };
      })
    }, 300, 900);
  } catch (error) {
    return errorResponse(error);
  }
};
