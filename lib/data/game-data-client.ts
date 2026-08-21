import { DATA_PROVIDER } from "@/config/data-provider";
import {
  dataQuery,
  requestData,
  requestDataResult,
  type DataApiResult,
} from "@/lib/data/api-client";

export type EngagementAction = "play" | "like" | "dislike" | "favorite";
export type LeaderboardPeriod = "daily" | "allTime";

function normalizedGameIds(gameIds: string[]) {
  return Array.from(new Set(gameIds.filter(Boolean))).sort();
}

export function fetchGameRatings<T>(gameIds: string[]): Promise<T> {
  return requestData<T>(
    dataQuery(DATA_PROVIDER.endpoints.ratings, {
      gameIds: normalizedGameIds(gameIds).join(","),
    }),
    {},
    "Unable to load game ratings.",
  );
}

export function fetchGameCardStats<T>(gameIds: string[]): Promise<T> {
  return requestData<T>(
    dataQuery(DATA_PROVIDER.endpoints.gameCards, {
      gameIds: normalizedGameIds(gameIds).join(","),
    }),
    {},
    "Unable to load game card statistics.",
  );
}

export function fetchGameEngagement<T>(
  gameId: string,
  visitorId: string,
): Promise<T> {
  return requestData<T>(
    dataQuery(DATA_PROVIDER.endpoints.gameEngagement(gameId), { visitorId }),
    { cache: "no-store" },
    "Unable to load game engagement.",
  );
}

export function updateGameEngagement<T>(
  gameId: string,
  visitorId: string,
  action: EngagementAction,
): Promise<T> {
  return requestData<T>(
    DATA_PROVIDER.endpoints.gameEngagement(gameId),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId, action }),
    },
    "Unable to update game engagement.",
  );
}

export function uploadMatchBatch<T>(events: unknown[]): Promise<T> {
  return requestData<T>(
    DATA_PROVIDER.endpoints.matchBatch,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events }),
    },
    "Unable to upload match events.",
  );
}

export function fetchTicker<T>(limit: number): Promise<T> {
  return requestData<T>(
    dataQuery(DATA_PROVIDER.endpoints.ticker, { limit }),
    {},
    "Unable to load live activity.",
  );
}

export function fetchLeaderboard<T>(
  period: LeaderboardPeriod,
  limit: number,
): Promise<T> {
  const endpoint = period === "daily"
    ? DATA_PROVIDER.endpoints.leaderboardDaily
    : DATA_PROVIDER.endpoints.leaderboardAllTime;
  return requestData<T>(
    dataQuery(endpoint, { limit }),
    {},
    "Leaderboard request failed.",
  );
}

export function fetchLeaderboardContext<T>(values: {
  period: LeaderboardPeriod;
  profileId: string;
  day?: string | null;
}): Promise<T> {
  return requestData<T>(
    dataQuery(DATA_PROVIDER.endpoints.leaderboardContext, values),
    {},
    "Leaderboard context request failed.",
  );
}

export function fetchLiveLeaderboard<T>(values: {
  period: LeaderboardPeriod;
  profileId: string;
  limit: number;
  day?: string | null;
}): Promise<DataApiResult<T>> {
  return requestDataResult<T>(
    dataQuery(DATA_PROVIDER.endpoints.leaderboardLive, values),
  );
}

export function fetchComments<T>(values: {
  gameId: string;
  visitorId: string;
  sort: string;
  limit: number;
  offset: number;
}, fallbackError = "Comments are temporarily unavailable."): Promise<T> {
  return requestData<T>(
    dataQuery(DATA_PROVIDER.endpoints.comments, values),
    { cache: "no-store" },
    fallbackError,
  );
}

export function submitComment<T>(body: {
  visitorId: string;
  gameId: string;
  parentId: string | null;
  author: string;
  content: string;
  rating: number | null;
}, fallbackError = "The comment could not be submitted."): Promise<T> {
  return requestData<T>(
    DATA_PROVIDER.endpoints.comments,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    fallbackError,
  );
}

export function reactToComment<T>(
  commentId: string,
  visitorId: string,
  reaction: "like" | "dislike",
  fallbackError = "The reaction could not be saved.",
): Promise<T> {
  return requestData<T>(
    DATA_PROVIDER.endpoints.commentReaction(commentId),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId, reaction }),
    },
    fallbackError,
  );
}
