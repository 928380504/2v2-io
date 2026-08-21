import { isSiteVisitorId } from "../../../lib/site-visitor";
import { requireDatabase } from "../../core/database";
import {
  ApiError,
  errorResponse,
  noStoreJson,
  optionsResponse,
  readJsonBody
} from "../../core/http";

const GAME_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
const PLAY_COOLDOWN_MS = 30 * 60 * 1000;

type GameReaction = "like" | "dislike";
type EngagementAction = "play" | "like" | "dislike" | "favorite";

interface EngagementStatsRow {
  play_count: number;
  like_count: number;
  dislike_count: number;
  favorite_count: number;
}

interface VisitorEngagementRow {
  reaction: GameReaction | null;
  is_favorite: number;
  last_play_at: number | null;
  like_votes: number;
  dislike_votes: number;
}

interface VoteUsageRow {
  like_votes: number;
  dislike_votes: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseGameId(value: unknown) {
  const gameId = Array.isArray(value) ? value[0] : value;
  if (typeof gameId !== "string" || !GAME_ID_PATTERN.test(gameId)) {
    throw new ApiError(400, "invalid_game_id", "gameId is invalid.");
  }
  return gameId;
}

function parseVisitorId(value: unknown) {
  if (!isSiteVisitorId(value)) {
    throw new ApiError(400, "invalid_visitor_id", "visitorId is invalid.");
  }
  return value.toLowerCase();
}

function parseAction(value: unknown): EngagementAction {
  if (
    value === "play" ||
    value === "like" ||
    value === "dislike" ||
    value === "favorite"
  ) {
    return value;
  }
  throw new ApiError(400, "invalid_action", "action is invalid.");
}

function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new ApiError(403, "origin_not_allowed", "The request origin is not allowed.");
  }
}

async function readEngagement(
  database: D1Database,
  gameId: string,
  visitorId: string
) {
  const [stats, viewer] = await Promise.all([
    database.prepare(`
      SELECT play_count, like_count, dislike_count, favorite_count
      FROM game_engagement_stats
      WHERE game_id = ?1
    `).bind(gameId).first<EngagementStatsRow>(),
    database.prepare(`
      SELECT
        engagement.reaction,
        COALESCE(engagement.is_favorite, 0) AS is_favorite,
        engagement.last_play_at,
        COALESCE(votes.like_votes, 0) AS like_votes,
        COALESCE(votes.dislike_votes, 0) AS dislike_votes
      FROM (SELECT ?1 AS game_id, ?2 AS visitor_id) AS requested
      LEFT JOIN game_visitor_engagement AS engagement
        ON engagement.game_id = requested.game_id
        AND engagement.visitor_id = requested.visitor_id
      LEFT JOIN game_engagement_vote_usage AS votes
        ON votes.game_id = requested.game_id
        AND votes.visitor_id = requested.visitor_id
    `).bind(gameId, visitorId).first<VisitorEngagementRow>()
  ]);

  return {
    gameId,
    counts: {
      plays: Number(stats?.play_count || 0),
      likes: Number(stats?.like_count || 0),
      dislikes: Number(stats?.dislike_count || 0),
      favorites: Number(stats?.favorite_count || 0)
    },
    viewer: {
      reaction: viewer?.reaction || null,
      favorite: Number(viewer?.is_favorite || 0) === 1,
      lastPlayAt: viewer?.last_play_at === null || viewer?.last_play_at === undefined
        ? null
        : Number(viewer.last_play_at),
      likeVotesUsed: Number(viewer?.like_votes || 0),
      dislikeVotesUsed: Number(viewer?.dislike_votes || 0)
    }
  };
}

export const onRequestOptions: PagesFunction = async () => optionsResponse();

export const onRequestGet: PagesFunction = async (context) => {
  try {
    const database = requireDatabase(context.env);
    const gameId = parseGameId(context.params.gameId);
    const visitorId = parseVisitorId(
      new URL(context.request.url).searchParams.get("visitorId")
    );
    return noStoreJson({
      ok: true,
      ...(await readEngagement(database, gameId, visitorId))
    });
  } catch (error) {
    return errorResponse(error);
  }
};

export const onRequestPost: PagesFunction = async (context) => {
  try {
    requireSameOrigin(context.request);
    const database = requireDatabase(context.env);
    const gameId = parseGameId(context.params.gameId);
    const body = await readJsonBody(context.request, 8 * 1024);
    if (!isRecord(body)) {
      throw new ApiError(400, "invalid_body", "Expected a JSON object.");
    }
    const visitorId = parseVisitorId(body.visitorId);
    const action = parseAction(body.action);
    const now = Date.now();
    let accepted: boolean | null = null;
    let counterStats: EngagementStatsRow | null = null;
    let voteUsage: VoteUsageRow | null = null;

    if (action === "play") {
      const result = await database.prepare(`
        INSERT INTO game_visitor_engagement (
          game_id,
          visitor_id,
          reaction,
          is_favorite,
          last_play_at,
          updated_at
        ) VALUES (?1, ?2, NULL, 0, ?3, ?3)
        ON CONFLICT (game_id, visitor_id) DO UPDATE SET
          last_play_at = excluded.last_play_at,
          updated_at = excluded.updated_at
        WHERE game_visitor_engagement.last_play_at IS NULL
          OR game_visitor_engagement.last_play_at <= ?4
      `).bind(gameId, visitorId, now, now - PLAY_COOLDOWN_MS).run();
      accepted = Number(result.meta.changes || 0) > 0;
    } else if (action === "like" || action === "dislike") {
      const likeIncrement = action === "like" ? 1 : 0;
      const dislikeIncrement = action === "dislike" ? 1 : 0;
      voteUsage = await database.prepare(`
        INSERT INTO game_engagement_vote_usage (
          game_id,
          visitor_id,
          like_votes,
          dislike_votes,
          updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5)
        ON CONFLICT (game_id, visitor_id) DO UPDATE SET
          like_votes = game_engagement_vote_usage.like_votes + excluded.like_votes,
          dislike_votes = game_engagement_vote_usage.dislike_votes + excluded.dislike_votes,
          updated_at = excluded.updated_at
        WHERE
          (excluded.like_votes = 0 OR game_engagement_vote_usage.like_votes < 5)
          AND
          (excluded.dislike_votes = 0 OR game_engagement_vote_usage.dislike_votes < 5)
        RETURNING like_votes, dislike_votes
      `).bind(
        gameId,
        visitorId,
        likeIncrement,
        dislikeIncrement,
        now,
      ).first<VoteUsageRow>();
      accepted = Boolean(voteUsage);

      if (accepted) {
        counterStats = await database.prepare(`
          INSERT INTO game_engagement_stats (
            game_id,
            play_count,
            like_count,
            dislike_count,
            favorite_count,
            updated_at
          ) VALUES (?1, 0, ?2, ?3, 0, ?4)
          ON CONFLICT (game_id) DO UPDATE SET
            like_count = game_engagement_stats.like_count + excluded.like_count,
            dislike_count = game_engagement_stats.dislike_count + excluded.dislike_count,
            updated_at = excluded.updated_at
          RETURNING play_count, like_count, dislike_count, favorite_count
        `).bind(gameId, likeIncrement, dislikeIncrement, now)
          .first<EngagementStatsRow>();
      }
    } else {
      accepted = true;
      counterStats = await database.prepare(`
        INSERT INTO game_engagement_stats (
          game_id,
          play_count,
          like_count,
          dislike_count,
          favorite_count,
          updated_at
        ) VALUES (?1, 0, 0, 0, 1, ?2)
        ON CONFLICT (game_id) DO UPDATE SET
          favorite_count = game_engagement_stats.favorite_count + excluded.favorite_count,
          updated_at = excluded.updated_at
        RETURNING play_count, like_count, dislike_count, favorite_count
      `).bind(gameId, now).first<EngagementStatsRow>();
    }

    if (counterStats) {
      return noStoreJson({
        ok: true,
        action,
        accepted,
        gameId,
        counts: {
          plays: Number(counterStats.play_count || 0),
          likes: Number(counterStats.like_count || 0),
          dislikes: Number(counterStats.dislike_count || 0),
          favorites: Number(counterStats.favorite_count || 0)
        },
        ...(voteUsage ? {
          viewer: {
            likeVotesUsed: Number(voteUsage.like_votes || 0),
            dislikeVotesUsed: Number(voteUsage.dislike_votes || 0)
          }
        } : {})
      });
    }

    return noStoreJson({
      ok: true,
      action,
      accepted,
      ...(await readEngagement(database, gameId, visitorId))
    });
  } catch (error) {
    return errorResponse(error);
  }
};
