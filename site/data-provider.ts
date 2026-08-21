/**
 * Dynamic-data provider configuration.
 *
 * Keep UI components independent from the deployment backend. A future site
 * can point these paths at another provider without changing component code.
 */
export const DATA_PROVIDER = {
  apiBasePath: "",
  endpoints: {
    gameCards: "/api/games/cards",
    gameEngagement: (gameId: string) =>
      `/api/games/${encodeURIComponent(gameId)}/engagement`,
    ratings: "/api/comments/ratings",
    comments: "/api/comments",
    commentReaction: (commentId: string) =>
      `/api/comments/${encodeURIComponent(commentId)}/reaction`,
    matchBatch: "/api/matches/batch",
    ticker: "/api/ticker",
    leaderboardDaily: "/api/leaderboard/daily",
    leaderboardAllTime: "/api/leaderboard/all-time",
    leaderboardContext: "/api/leaderboard/context",
    leaderboardLive: "/api/leaderboard/live",
  },
  competition: {
    mode: "1v1",
    metricField: "wins",
    previousPeriodMetricField: "previousDayWins",
    metricLabel: "WINS",
    metricSingular: "win",
    metricPlural: "wins",
    previousPeriodLabel: "yesterday",
    previousPodiumPlaceholder: "Yesterday's podium · 0 wins today",
    activity: {
      resultType: "live",
      streakType: "streak",
      rankingType: "arena",
      resultBadge: "LIVE",
      streakBadge: "STREAK",
      rankingBadge: "ARENA",
      waitingText: "Waiting for the next 1v1 result…",
      resultVerb: "defeated",
      defaultOpponent: "an opponent",
      defaultModeLabel: "1v1 Casual",
      streakNoun: "win streak",
      streakFallbackLabel: "Streak Milestone",
      rankingFallbackLabel: "Challenger",
      revengeAchievementKey: "sweet_revenge",
      revengeText: "sweet revenge!",
    },
  },
  cache: {
    ratingsMs: 15 * 60 * 1000,
    gameCardsMs: 15 * 60 * 1000,
    engagementMs: 15 * 60 * 1000,
    tickerMs: 15 * 60 * 1000,
    leaderboardDailyMs: 3 * 60 * 60 * 1000,
    leaderboardAllTimeMs: 24 * 60 * 60 * 1000,
  },
  limits: {
    ratingsBatch: 50,
    gameCardsBatch: 50,
    tickerItems: 20,
    leaderboardRanks: 100,
  },
} as const;
