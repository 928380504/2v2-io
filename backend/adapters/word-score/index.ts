import type { CompetitionAdapter } from "../../contracts";
import {
  leaderboardAllTimeGet,
  leaderboardContextGet,
  leaderboardDailyGet,
  leaderboardLiveGet,
  matchesBatchPost,
  options,
  profileGet,
  tickerGet,
} from "./handlers";

export const wordScoreAdapter = {
  id: "word-score",
  gameId: "text-twist-2-untimed",
  modeKey: "untimed",
  eventSchemaVersion: 1,
  migrationGroup: "word-score",
  handlers: {
    ticker: { options, get: tickerGet },
    profile: { options, get: profileGet },
    leaderboardDaily: { options, get: leaderboardDailyGet },
    leaderboardAllTime: { options, get: leaderboardAllTimeGet },
    leaderboardContext: { options, get: leaderboardContextGet },
    leaderboardLive: { options, get: leaderboardLiveGet },
    matchesBatch: { options, post: matchesBatchPost },
  },
} as const satisfies CompetitionAdapter;

