import { requireDatabase } from "../../core/database";
import {
  cachedJson,
  errorResponse,
  matchSharedGetCache,
  nextSiteDayReset,
  optionsResponse,
  parseIntegerQuery,
  scheduleSharedGetCache,
  sharedGetCacheKey,
  siteDayKey
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
      period: "allTime",
      limit,
      offset
    });
    const cached = await matchSharedGetCache(cacheKey);
    if (cached) return cached;

    const database = requireDatabase(context.env);
    await ensureDailyPodium(
      database,
      previousSiteDay(siteDayKey(now)),
      now
    );
    const snapshot = await queryLeaderboardSnapshotPage(database, {
      period: "allTime",
      day: null,
      limit,
      offset,
      previousDay: null,
      now,
      waitUntil: (promise) => context.waitUntil(promise)
    });
    const leaderboard = snapshot || {
      generatedAt: now,
      dataSource: "live" as const,
      ...(await queryLeaderboardPage(database, {
        period: "allTime",
        day: null,
        limit,
        offset,
        previousDay: null
      }))
    };

    const secondsUntilReset = Math.max(
      1,
      Math.floor((nextSiteDayReset(now) - now) / 1000)
    );
    const edgeCacheSeconds = Math.min(300, secondsUntilReset);
    const response = cachedJson({
      ok: true,
      period: "allTime",
      mode: "1v1",
      day: null,
      resetAt: null,
      limit,
      offset,
      ...leaderboard
    }, edgeCacheSeconds, 0);
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
