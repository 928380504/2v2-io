"use client";

import {
  isRemoteGameRatingFresh,
  markRemoteGameRatingsFetched,
  syncRemoteCommentRatings,
  type GameRatingSeed,
} from "@/lib/game-rating-store";
import { fetchGameRatings } from "@/lib/data/game-data-client";
import { DATA_PROVIDER } from "@/config/data-provider";

const RATING_CACHE_TTL_MS = DATA_PROVIDER.cache.ratingsMs;
const MAXIMUM_BATCH_SIZE = DATA_PROVIDER.limits.ratingsBatch;
const BATCH_DELAY_MS = 20;

interface RatingsApiItem extends GameRatingSeed {
  gameId: string;
}

interface RatingsApiResponse {
  ok: boolean;
  items?: RatingsApiItem[];
}

const pendingGameIds = new Set<string>();
const inFlightGameIds = new Set<string>();
let batchTimer: ReturnType<typeof setTimeout> | null = null;

function isRatingsApiItem(value: unknown): value is RatingsApiItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<RatingsApiItem>;
  return (
    typeof item.gameId === "string" &&
    typeof item.score === "number" &&
    Number.isFinite(item.score) &&
    typeof item.votes === "number" &&
    Number.isFinite(item.votes)
  );
}

async function fetchRatingBatch(gameIds: string[]) {
  gameIds.forEach((gameId) => inFlightGameIds.add(gameId));
  try {
    const payload = await fetchGameRatings<RatingsApiResponse>(gameIds);
    if (!payload.ok || !Array.isArray(payload.items)) return;

    const ratings: Record<string, GameRatingSeed> = {};
    payload.items.filter(isRatingsApiItem).forEach((item) => {
      ratings[item.gameId] = {
        score: item.score,
        votes: item.votes,
      };
    });
    syncRemoteCommentRatings(ratings, gameIds);
    markRemoteGameRatingsFetched(gameIds);
  } catch {
    // Static fallback ratings remain visible while the API is unavailable.
  } finally {
    gameIds.forEach((gameId) => inFlightGameIds.delete(gameId));
  }
}

function flushPendingRatings() {
  batchTimer = null;
  const gameIds = Array.from(pendingGameIds).slice(0, MAXIMUM_BATCH_SIZE);
  gameIds.forEach((gameId) => pendingGameIds.delete(gameId));

  if (gameIds.length > 0) void fetchRatingBatch(gameIds);
  if (pendingGameIds.size > 0) scheduleFlush();
}

function scheduleFlush() {
  if (batchTimer !== null) return;
  batchTimer = setTimeout(flushPendingRatings, BATCH_DELAY_MS);
}

export function queueRemoteGameRating(gameId: string) {
  if (
    !gameId ||
    inFlightGameIds.has(gameId) ||
    pendingGameIds.has(gameId) ||
    isRemoteGameRatingFresh(gameId, RATING_CACHE_TTL_MS)
  ) {
    return;
  }

  pendingGameIds.add(gameId);
  scheduleFlush();
}
