import type { CompetitionAdapter } from "../../contracts";
import * as ticker from "./ticker";
import * as profile from "./profile";
import * as leaderboardDaily from "./leaderboard-daily";
import * as leaderboardAllTime from "./leaderboard-all-time";
import * as leaderboardContext from "./leaderboard-context";
import * as leaderboardLive from "./leaderboard-live";
import * as matchesBatch from "./matches-batch";

export const oneVOneLolAdapter = {
  id: "1v1-lol",
  gameId: "1v1-lol",
  modeKey: "1v1",
  eventSchemaVersion: 3,
  migrationGroup: "1v1-lol",
  handlers: {
    ticker: {
      options: ticker.onRequestOptions,
      get: ticker.onRequestGet
    },
    profile: {
      options: profile.onRequestOptions,
      get: profile.onRequestGet
    },
    leaderboardDaily: {
      options: leaderboardDaily.onRequestOptions,
      get: leaderboardDaily.onRequestGet
    },
    leaderboardAllTime: {
      options: leaderboardAllTime.onRequestOptions,
      get: leaderboardAllTime.onRequestGet
    },
    leaderboardContext: {
      options: leaderboardContext.onRequestOptions,
      get: leaderboardContext.onRequestGet
    },
    leaderboardLive: {
      options: leaderboardLive.onRequestOptions,
      get: leaderboardLive.onRequestGet
    },
    matchesBatch: {
      options: matchesBatch.onRequestOptions,
      post: matchesBatch.onRequestPost
    }
  }
} as const satisfies CompetitionAdapter;
