import { requireDatabase } from "../../core/database";
import {
  ApiError,
  errorResponse,
  nextSiteDayReset,
  noStoreJson,
  optionsResponse,
  parseDay,
  parseIntegerQuery,
  siteDayKey
} from "../../core/http";
import {
  consumeLiveLeaderboardRefresh,
  ensureDailyPodium,
  LeaderboardPeriod,
  parseOptionalProfileId,
  previousSiteDay,
  queryLiveLeaderboard
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
    if (!profileId) {
      throw new ApiError(
        400,
        "profile_required",
        "A local player profile is required for live rankings."
      );
    }

    const day = period === "daily"
      ? parseDay(url.searchParams.get("day"), now)
      : null;
    const previousDay = day ? previousSiteDay(day) : null;
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

    await ensureDailyPodium(
      database,
      previousSiteDay(siteDayKey(now)),
      now
    );
    const liveRefresh = await consumeLiveLeaderboardRefresh(database, {
      period,
      day,
      profileId,
      now
    });
    const leaderboard = await queryLiveLeaderboard(database, {
      period,
      day,
      limit,
      offset,
      profileId,
      previousDay
    });

    return noStoreJson({
      ok: true,
      period,
      mode: "1v1",
      day,
      resetAt: period === "daily" ? nextSiteDayReset(now) : null,
      generatedAt: now,
      dataSource: "live",
      liveRefresh,
      limit,
      offset,
      ...leaderboard
    });
  } catch (error) {
    return errorResponse(error);
  }
};
