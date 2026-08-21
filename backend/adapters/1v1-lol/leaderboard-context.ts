import { requireDatabase } from "../../core/database";
import {
  cachedJson,
  errorResponse,
  nextSiteDayReset,
  optionsResponse,
  parseDay,
  siteDayKey
} from "../../core/http";
import {
  ensureDailyPodium,
  LeaderboardPeriod,
  parseOptionalProfileId,
  previousSiteDay,
  queryLeaderboardContext,
  queryLeaderboardSnapshotContext
} from "./leaderboard";

function parsePeriod(value: string | null): LeaderboardPeriod {
  return value === "allTime" ? "allTime" : "daily";
}

export const onRequestOptions: PagesFunction = async () => optionsResponse();

export const onRequestGet: PagesFunction = async (context) => {
  try {
    const database = requireDatabase(context.env);
    const url = new URL(context.request.url);
    const now = Date.now();
    const period = parsePeriod(url.searchParams.get("period"));
    const profileId = parseOptionalProfileId(
      url.searchParams.get("profileId")
    );
    const day = period === "daily"
      ? parseDay(url.searchParams.get("day"), now)
      : null;

    if (!profileId) {
      return cachedJson({
        ok: true,
        period,
        mode: "1v1",
        day,
        resetAt: period === "daily" ? nextSiteDayReset(now) : null,
        generatedAt: now,
        dataSource: "snapshot",
        totalPlayers: 0,
        currentPlayer: null,
        currentWindow: []
      }, 60, 120);
    }

    const previousDay = day ? previousSiteDay(day) : null;
    await ensureDailyPodium(
      database,
      previousSiteDay(siteDayKey(now)),
      now
    );
    const snapshot = await queryLeaderboardSnapshotContext(database, {
      period,
      day,
      profileId,
      previousDay,
      now,
      waitUntil: (promise) => context.waitUntil(promise)
    });
    const result = snapshot || {
      generatedAt: now,
      dataSource: "live" as const,
      ...(await queryLeaderboardContext(database, {
        period,
        day,
        profileId,
        previousDay
      }))
    };

    return cachedJson({
      ok: true,
      period,
      mode: "1v1",
      day,
      resetAt: period === "daily" ? nextSiteDayReset(now) : null,
      ...result
    }, 60, 120);
  } catch (error) {
    return errorResponse(error);
  }
};
