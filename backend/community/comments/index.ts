import { normalizeComparableComment, validateCommentText } from "../../../lib/comment-moderation";
import { isSiteVisitorId } from "../../../lib/site-visitor";
import { countryCodeFromRequest, requireDatabase } from "../../core/database";
import {
  ApiError,
  errorResponse,
  noStoreJson,
  optionsResponse,
  parseIntegerQuery,
  readJsonBody,
  siteDayKey
} from "../../core/http";

const GAME_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
const DAILY_COMMENT_LIMIT = 3;

type CommentSort = "newest" | "oldest" | "popular";
type CommentReaction = "like" | "dislike";

interface CommentRow {
  comment_id: string;
  game_id: string;
  parent_id: string | null;
  author: string;
  content: string;
  rating: number | null;
  likes: number;
  dislikes: number;
  country_code: string;
  created_at: number;
  user_reaction: CommentReaction | null;
}

interface CommentStatsRow {
  comment_count: number;
  root_count: number;
  rating_sum: number;
  rating_count: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseGameId(value: unknown): string {
  if (typeof value !== "string" || !GAME_ID_PATTERN.test(value)) {
    throw new ApiError(400, "invalid_game_id", "gameId is invalid.");
  }
  return value;
}

function parseSort(value: string | null): CommentSort {
  if (!value || value === "newest") return "newest";
  if (value === "oldest" || value === "popular") return value;
  throw new ApiError(400, "invalid_sort", "sort must be newest, oldest, or popular.");
}

function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new ApiError(403, "origin_not_allowed", "The request origin is not allowed.");
  }
}

async function createFingerprint(content: string) {
  const normalized = normalizeComparableComment(content);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(normalized)
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

function mapComment(row: CommentRow) {
  return {
    id: row.comment_id,
    gameId: row.game_id,
    parentId: row.parent_id,
    author: row.author,
    content: row.content,
    rating: row.rating === null ? null : Number(row.rating),
    likes: Number(row.likes),
    dislikes: Number(row.dislikes),
    countryCode: row.country_code,
    createdAt: Number(row.created_at),
    userReaction: row.user_reaction
  };
}

function ratingSummary(stats: CommentStatsRow | null) {
  const votes = Number(stats?.rating_count || 0);
  const score = votes > 0
    ? Number(stats?.rating_sum || 0) / votes
    : 0;
  return { score, votes };
}

async function readCommentStats(database: D1Database, gameId: string) {
  return database.prepare(`
    SELECT comment_count, root_count, rating_sum, rating_count
    FROM comment_game_stats
    WHERE game_id = ?1
  `).bind(gameId).first<CommentStatsRow>();
}

export const onRequestOptions: PagesFunction = async () => optionsResponse();

export const onRequestGet: PagesFunction = async (context) => {
  try {
    const database = requireDatabase(context.env);
    const url = new URL(context.request.url);
    const gameId = parseGameId(url.searchParams.get("gameId"));
    const visitorIdValue = url.searchParams.get("visitorId");
    const visitorId = isSiteVisitorId(visitorIdValue)
      ? visitorIdValue.toLowerCase()
      : "";
    const sort = parseSort(url.searchParams.get("sort"));
    const limit = parseIntegerQuery(url.searchParams.get("limit"), 5, 1, 20, "limit");
    const offset = parseIntegerQuery(url.searchParams.get("offset"), 0, 0, 10_000, "offset");
    const orderBy = sort === "oldest"
      ? "c.created_at ASC, c.comment_id ASC"
      : sort === "popular"
        ? "(c.likes - c.dislikes) DESC, c.created_at DESC, c.comment_id DESC"
        : "c.created_at DESC, c.comment_id DESC";

    const rootsResult = await database.prepare(`
      SELECT
        c.comment_id,
        c.game_id,
        c.parent_id,
        c.author,
        c.content,
        c.rating,
        c.likes,
        c.dislikes,
        c.country_code,
        c.created_at,
        (
          SELECT reaction
          FROM comment_reactions r
          WHERE r.comment_id = c.comment_id AND r.visitor_id = ?2
        ) AS user_reaction
      FROM comments c
      WHERE c.game_id = ?1
        AND c.status = 'published'
        AND c.parent_id IS NULL
      ORDER BY ${orderBy}
      LIMIT ?3 OFFSET ?4
    `).bind(gameId, visitorId, limit + 1, offset).all<CommentRow>();

    const fetchedRoots = rootsResult.results || [];
    const hasMore = fetchedRoots.length > limit;
    const roots = fetchedRoots.slice(0, limit);
    let replies: CommentRow[] = [];

    if (roots.length > 0) {
      const rootPlaceholders = roots.map((_, index) => `?${index + 1}`).join(", ");
      const visitorParameter = roots.length + 1;
      const replyResult = await database.prepare(`
        WITH RECURSIVE thread AS (
          SELECT child.*
          FROM comments child
          WHERE child.parent_id IN (${rootPlaceholders})
            AND child.status = 'published'

          UNION ALL

          SELECT child.*
          FROM comments child
          JOIN thread parent ON child.parent_id = parent.comment_id
          WHERE child.status = 'published'
        )
        SELECT
          c.comment_id,
          c.game_id,
          c.parent_id,
          c.author,
          c.content,
          c.rating,
          c.likes,
          c.dislikes,
          c.country_code,
          c.created_at,
          (
            SELECT reaction
            FROM comment_reactions r
            WHERE r.comment_id = c.comment_id
              AND r.visitor_id = ?${visitorParameter}
          ) AS user_reaction
        FROM thread c
        ORDER BY c.created_at ASC, c.comment_id ASC
      `).bind(
        ...roots.map((comment) => comment.comment_id),
        visitorId
      ).all<CommentRow>();
      replies = replyResult.results || [];
    }

    const stats = await readCommentStats(database, gameId);

    return noStoreJson({
      ok: true,
      gameId,
      sort,
      offset,
      nextOffset: offset + roots.length,
      hasMore,
      totalComments: Number(stats?.comment_count || 0),
      totalThreads: Number(stats?.root_count || 0),
      ratingSummary: ratingSummary(stats),
      items: [...roots, ...replies].map(mapComment)
    });
  } catch (error) {
    return errorResponse(error);
  }
};

export const onRequestPost: PagesFunction = async (context) => {
  try {
    requireSameOrigin(context.request);
    const database = requireDatabase(context.env);
    const body = await readJsonBody(context.request, 8 * 1024);
    if (!isRecord(body)) {
      throw new ApiError(400, "invalid_body", "Expected a comment object.");
    }

    const visitorId = isSiteVisitorId(body.visitorId)
      ? body.visitorId.toLowerCase()
      : null;
    if (!visitorId) {
      throw new ApiError(400, "invalid_visitor_id", "visitorId is invalid.");
    }

    const gameId = parseGameId(body.gameId);
    const author = typeof body.author === "string" ? body.author.trim() : "";
    const content = typeof body.content === "string" ? body.content.trim() : "";
    const parentId = body.parentId === null || body.parentId === undefined
      ? null
      : isSiteVisitorId(body.parentId)
        ? body.parentId.toLowerCase()
        : null;
    if (body.parentId !== null && body.parentId !== undefined && !parentId) {
      throw new ApiError(400, "invalid_parent_id", "parentId is invalid.");
    }
    if (!author || author.length > 40) {
      throw new ApiError(400, "invalid_author", "Author must be 1 to 40 characters.");
    }
    if (!content || content.length > 1000) {
      throw new ApiError(400, "invalid_content", "Comment must be 1 to 1000 characters.");
    }

    const submittedRating = Number(body.rating);
    if (
      parentId === null &&
      (!Number.isInteger(submittedRating) ||
        submittedRating < 1 ||
        submittedRating > 5)
    ) {
      throw new ApiError(400, "invalid_rating", "A rating from 1 to 5 is required.");
    }
    const rating = parentId === null ? submittedRating : null;

    const moderationError = validateCommentText(author, content);
    if (moderationError) {
      throw new ApiError(422, "comment_rejected", moderationError);
    }

    if (parentId) {
      const parent = await database.prepare(`
        SELECT game_id
        FROM comments
        WHERE comment_id = ?1 AND status = 'published'
      `).bind(parentId).first<{ game_id: string }>();
      if (!parent || parent.game_id !== gameId) {
        throw new ApiError(404, "parent_not_found", "The comment being replied to was not found.");
      }
    }

    const now = Date.now();
    const day = siteDayKey(now);
    const fingerprint = await createFingerprint(content);
    const duplicate = await database.prepare(`
      SELECT comment_id
      FROM comments
      WHERE visitor_id = ?1 AND day_key = ?2 AND content_fingerprint = ?3
      LIMIT 1
    `).bind(visitorId, day, fingerprint).first<{ comment_id: string }>();
    if (duplicate) {
      throw new ApiError(409, "duplicate_comment", "Please do not post the same comment repeatedly.");
    }

    const commentId = crypto.randomUUID();
    const countryCode = countryCodeFromRequest(context.request);
    const rootIncrement = parentId === null ? 1 : 0;
    const ratingValue = rating || 0;
    const ratingIncrement = parentId === null ? 1 : 0;
    const results = await database.batch([
      database.prepare(`
        INSERT INTO comments (
          comment_id,
          game_id,
          visitor_id,
          parent_id,
          author,
          content,
          content_fingerprint,
          rating,
          country_code,
          created_at,
          day_key
        )
        SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11
        WHERE COALESCE((
          SELECT comment_count
          FROM comment_daily_usage
          WHERE visitor_id = ?3 AND day_key = ?11
        ), 0) < ${DAILY_COMMENT_LIMIT}
      `).bind(
        commentId,
        gameId,
        visitorId,
        parentId,
        author,
        content,
        fingerprint,
        rating,
        countryCode,
        now,
        day
      ),
      database.prepare(`
        INSERT INTO comment_daily_usage (
          visitor_id, day_key, comment_count, updated_at
        )
        SELECT ?1, ?2, 1, ?3
        WHERE EXISTS (
          SELECT 1 FROM comments WHERE comment_id = ?4
        )
        ON CONFLICT (visitor_id, day_key) DO UPDATE SET
          comment_count = comment_daily_usage.comment_count + 1,
          updated_at = excluded.updated_at
        WHERE comment_daily_usage.comment_count < ${DAILY_COMMENT_LIMIT}
      `).bind(visitorId, day, now, commentId),
      database.prepare(`
        INSERT INTO comment_game_stats (
          game_id,
          comment_count,
          root_count,
          rating_sum,
          rating_count,
          updated_at
        )
        SELECT ?1, 1, ?2, ?3, ?4, ?5
        WHERE EXISTS (
          SELECT 1 FROM comments WHERE comment_id = ?6
        )
        ON CONFLICT (game_id) DO UPDATE SET
          comment_count = comment_game_stats.comment_count + 1,
          root_count = comment_game_stats.root_count + excluded.root_count,
          rating_sum = comment_game_stats.rating_sum + excluded.rating_sum,
          rating_count = comment_game_stats.rating_count + excluded.rating_count,
          updated_at = excluded.updated_at
      `).bind(
        gameId,
        rootIncrement,
        ratingValue,
        ratingIncrement,
        now,
        commentId
      )
    ]);

    if ((results[0]?.meta?.changes || 0) < 1) {
      throw new ApiError(
        429,
        "daily_comment_limit",
        "You can post up to 3 comments per day. Please try again tomorrow."
      );
    }

    const usage = await database.prepare(`
      SELECT comment_count
      FROM comment_daily_usage
      WHERE visitor_id = ?1 AND day_key = ?2
    `).bind(visitorId, day).first<{ comment_count: number }>();
    const stats = await readCommentStats(database, gameId);

    return noStoreJson({
      ok: true,
      item: {
        id: commentId,
        gameId,
        parentId,
        author,
        content,
        rating,
        likes: 0,
        dislikes: 0,
        countryCode,
        createdAt: now,
        userReaction: null
      },
      remainingComments: Math.max(
        0,
        DAILY_COMMENT_LIMIT - Number(usage?.comment_count || 0)
      ),
      totalComments: Number(stats?.comment_count || 0),
      ratingSummary: ratingSummary(stats)
    }, 201);
  } catch (error) {
    return errorResponse(error);
  }
};
