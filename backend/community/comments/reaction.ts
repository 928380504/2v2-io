import { isSiteVisitorId } from "../../../lib/site-visitor";
import { requireDatabase } from "../../core/database";
import {
  ApiError,
  errorResponse,
  noStoreJson,
  optionsResponse,
  readJsonBody
} from "../../core/http";

type CommentReaction = "like" | "dislike";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new ApiError(403, "origin_not_allowed", "The request origin is not allowed.");
  }
}

export const onRequestOptions: PagesFunction = async () => optionsResponse();

export const onRequestPost: PagesFunction = async (context) => {
  try {
    requireSameOrigin(context.request);
    const database = requireDatabase(context.env);
    const commentIdParam = context.params.commentId;
    const commentId = Array.isArray(commentIdParam)
      ? commentIdParam[0]
      : commentIdParam;
    if (!isSiteVisitorId(commentId)) {
      throw new ApiError(400, "invalid_comment_id", "commentId is invalid.");
    }

    const body = await readJsonBody(context.request, 2 * 1024);
    if (!isRecord(body) || !isSiteVisitorId(body.visitorId)) {
      throw new ApiError(400, "invalid_visitor_id", "visitorId is invalid.");
    }
    const visitorId = body.visitorId.toLowerCase();
    const requestedReaction = body.reaction;
    if (requestedReaction !== "like" && requestedReaction !== "dislike") {
      throw new ApiError(400, "invalid_reaction", "reaction must be like or dislike.");
    }

    const comment = await database.prepare(`
      SELECT likes, dislikes
      FROM comments
      WHERE comment_id = ?1 AND status = 'published'
    `).bind(commentId).first<{ likes: number; dislikes: number }>();
    if (!comment) {
      throw new ApiError(404, "comment_not_found", "The comment was not found.");
    }

    const existing = await database.prepare(`
      SELECT reaction
      FROM comment_reactions
      WHERE comment_id = ?1 AND visitor_id = ?2
    `).bind(commentId, visitorId).first<{ reaction: CommentReaction }>();
    const previousReaction = existing?.reaction || null;
    const nextReaction = previousReaction === requestedReaction
      ? null
      : requestedReaction;
    const likeDelta =
      (nextReaction === "like" ? 1 : 0) -
      (previousReaction === "like" ? 1 : 0);
    const dislikeDelta =
      (nextReaction === "dislike" ? 1 : 0) -
      (previousReaction === "dislike" ? 1 : 0);

    const reactionStatement = nextReaction === null
      ? database.prepare(`
          DELETE FROM comment_reactions
          WHERE comment_id = ?1 AND visitor_id = ?2
        `).bind(commentId, visitorId)
      : database.prepare(`
          INSERT INTO comment_reactions (
            comment_id, visitor_id, reaction, created_at
          ) VALUES (?1, ?2, ?3, ?4)
          ON CONFLICT (comment_id, visitor_id) DO UPDATE SET
            reaction = excluded.reaction,
            created_at = excluded.created_at
        `).bind(commentId, visitorId, nextReaction, Date.now());

    await database.batch([
      reactionStatement,
      database.prepare(`
        UPDATE comments
        SET
          likes = MAX(0, likes + ?2),
          dislikes = MAX(0, dislikes + ?3)
        WHERE comment_id = ?1 AND status = 'published'
      `).bind(commentId, likeDelta, dislikeDelta)
    ]);

    const updated = await database.prepare(`
      SELECT likes, dislikes
      FROM comments
      WHERE comment_id = ?1
    `).bind(commentId).first<{ likes: number; dislikes: number }>();

    return noStoreJson({
      ok: true,
      commentId,
      likes: Number(updated?.likes || 0),
      dislikes: Number(updated?.dislikes || 0),
      userReaction: nextReaction
    });
  } catch (error) {
    return errorResponse(error);
  }
};

