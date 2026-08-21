import { requireDatabase } from "../../core/database";
import {
  cachedJson,
  errorResponse,
  matchSharedGetCache,
  nextSiteDayReset,
  optionsResponse,
  parseDay,
  parseIntegerQuery,
  scheduleSharedGetCache,
  sharedGetCacheKey
} from "../../core/http";
import {
  ensureDailyPodium,
  previousSiteDay,
  queryLeaderboardPage,
  queryLeaderboardSnapshotPage
} from "./leaderboard";

export const onRequestOptions: PagesFunction = async () => optionsResponse();

export const onRequestGet: PagesFunction = async (context) => {
  try {
    const url = new URL(context.request.url);
    const now = Date.now();
    const day = parseDay(url.searchParams.get("day"), now);
    const limit = parseIntegerQuery(
      url.searchParams.get("limit"),
      100,
      1,
      100,
      "limit"
    );
    const offset = parseIntegerQuery(
      url.searchParams.get("offset"),
      0,
      0,
      10_000,
      "offset"
    );
    const cacheKey = sharedGetCacheKey(context.request, {
      period: "daily",
      day,
      limit,
      offset
    });
    const cached = await matchSharedGetCache(cacheKey);
    if (cached) return cached;

    const database = requireDatabase(context.env);
    const previousDay = previousSiteDay(day);
    await ensureDailyPodium(database, previousDay, now);
    const snapshot = await queryLeaderboardSnapshotPage(database, {
      period: "daily",
      day,
      limit,
      offset,
      previousDay,
      now,
      waitUntil: (promise) => context.waitUntil(promise)
    });
    const leaderboard = snapshot || {
      generatedAt: now,
      dataSource: "live" as const,
      ...(await queryLeaderboardPage(database, {
        period: "daily",
        day,
        limit,
        offset,
        previousDay
      }))
    };

    const response = cachedJson({
      ok: true,
      period: "daily",
      mode: "1v1",
      day,
      resetAt: nextSiteDayReset(now),
      limit,
      offset,
      ...leaderboard
    }, 300, 600);
    scheduleSharedGetCache(
      cacheKey,
      response,
      (promise) => context.waitUntil(promise)
    );
    return response;
  } catch (error) {
    return errorResponse(error);
  }
};
