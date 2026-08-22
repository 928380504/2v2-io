import { gameRankingExcludedIds } from "@/site/content/popular-games";

export const GAME_POPULARITY_WEIGHTS = {
  plays: 1,
  likes: 5,
  favorites: 50,
} as const;

/** Every Hot Games page shows the same global top-21 ranking. */
export const HOT_GAMES_PAGE_LIMIT = 21;

export const NEW_GAME_BADGE_MAX_AGE_MS = 45 * 24 * 60 * 60 * 1000;

export type GameRankingBadge = "top" | "new" | "hot";

export interface GameRankingStats {
  plays?: number;
  likes?: number;
  favorites?: number;
}

export interface RankableGame extends GameRankingStats {
  id: string;
  siteAddedAt?: string;
}

export interface RankedGame<T extends RankableGame> {
  game: T;
  rank: number;
}

export interface GameRankingBadgeLimits {
  topEnd: number;
  hotStart: number;
  hotEnd: number;
  newCount: number;
}

export interface GlobalGameRankingSnapshot<T extends RankableGame> {
  popular: RankedGame<T>[];
  newGames: RankedGame<T>[];
  popularRankById: ReadonlyMap<string, number>;
  newRankById: ReadonlyMap<string, number>;
  eligibleCount: number;
  badgeLimits: GameRankingBadgeLimits;
  usesLiveStats: boolean;
}

function normalizeCount(value: unknown) {
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}

function metricsForGame<T extends RankableGame>(
  game: T,
  stats: Readonly<Record<string, GameRankingStats>>,
  useLiveStats: boolean,
) {
  const source = useLiveStats ? stats[game.id] : game;
  return {
    plays: normalizeCount(source?.plays),
    likes: normalizeCount(source?.likes),
    favorites: normalizeCount(source?.favorites),
  };
}

function hasCompleteLiveStats<T extends RankableGame>(
  games: readonly T[],
  stats: Readonly<Record<string, GameRankingStats>>,
) {
  return games.length > 0 && games.every((game) => Boolean(stats[game.id]));
}

export function isGameRankingEligible(gameId: string): boolean {
  return !gameRankingExcludedIds.has(gameId);
}

export function getGamePopularityScore(stats: GameRankingStats) {
  return (
    normalizeCount(stats.plays) * GAME_POPULARITY_WEIGHTS.plays +
    normalizeCount(stats.likes) * GAME_POPULARITY_WEIGHTS.likes +
    normalizeCount(stats.favorites) * GAME_POPULARITY_WEIGHTS.favorites
  );
}

export function sortByPopularGameOrder<T extends RankableGame>(
  games: readonly T[],
  stats: Readonly<Record<string, GameRankingStats>>,
): T[] {
  const eligibleGames = games.filter((game) => isGameRankingEligible(game.id));
  const useLiveStats = hasCompleteLiveStats(eligibleGames, stats);
  const metrics = new Map(
    eligibleGames.map((game) => [
      game.id,
      metricsForGame(game, stats, useLiveStats),
    ]),
  );

  return [...eligibleGames].sort((left, right) => {
    const leftMetrics = metrics.get(left.id)!;
    const rightMetrics = metrics.get(right.id)!;
    return (
      getGamePopularityScore(rightMetrics) -
        getGamePopularityScore(leftMetrics) ||
      rightMetrics.favorites - leftMetrics.favorites ||
      rightMetrics.likes - leftMetrics.likes ||
      rightMetrics.plays - leftMetrics.plays ||
      String(right.siteAddedAt || "").localeCompare(
        String(left.siteAddedAt || ""),
      ) ||
      left.id.localeCompare(right.id)
    );
  });
}

export function sortByNewGameOrder<T extends RankableGame>(
  games: readonly T[],
): T[] {
  return games
    .filter((game) => isGameRankingEligible(game.id))
    .sort(
      (left, right) =>
        String(right.siteAddedAt || "").localeCompare(
          String(left.siteAddedAt || ""),
        ) || left.id.localeCompare(right.id),
    );
}

export function getAdaptiveGameBadgeLimits(
  eligibleCount: number,
): GameRankingBadgeLimits {
  if (eligibleCount < 30) {
    return {
      topEnd: Math.min(3, eligibleCount),
      hotStart: 4,
      hotEnd: Math.min(8, eligibleCount),
      newCount: Math.min(5, eligibleCount),
    };
  }

  return {
    topEnd: Math.min(5, eligibleCount),
    hotStart: 6,
    hotEnd: Math.min(15, eligibleCount),
    newCount: Math.min(10, eligibleCount),
  };
}

export function createGlobalGameRankingSnapshot<T extends RankableGame>(
  games: readonly T[],
  stats: Readonly<Record<string, GameRankingStats>>,
): GlobalGameRankingSnapshot<T> {
  const eligibleGames = games.filter((game) => isGameRankingEligible(game.id));
  const popularGames = sortByPopularGameOrder(eligibleGames, stats);
  const newGames = sortByNewGameOrder(eligibleGames);
  const popular = popularGames.map((game, index) => ({
    game,
    rank: index + 1,
  }));
  const rankedNewGames = newGames.map((game, index) => ({
    game,
    rank: index + 1,
  }));

  return {
    popular,
    newGames: rankedNewGames,
    popularRankById: new Map(
      popular.map(({ game, rank }) => [game.id, rank]),
    ),
    newRankById: new Map(
      rankedNewGames.map(({ game, rank }) => [game.id, rank]),
    ),
    eligibleCount: eligibleGames.length,
    badgeLimits: getAdaptiveGameBadgeLimits(eligibleGames.length),
    usesLiveStats: hasCompleteLiveStats(eligibleGames, stats),
  };
}

export function getGameRankingBadge(
  game: RankableGame,
  rankings: Pick<
    GlobalGameRankingSnapshot<RankableGame>,
    "popularRankById" | "newRankById" | "badgeLimits"
  >,
  now = Date.now(),
): GameRankingBadge | null {
  const popularRank = rankings.popularRankById.get(game.id);
  if (popularRank && popularRank <= rankings.badgeLimits.topEnd) {
    return "top";
  }

  const addedAt = Date.parse(game.siteAddedAt || "");
  const age = now - addedAt;
  const newRank = rankings.newRankById.get(game.id);
  if (
    newRank &&
    newRank <= rankings.badgeLimits.newCount &&
    Number.isFinite(addedAt) &&
    age >= 0 &&
    age <= NEW_GAME_BADGE_MAX_AGE_MS
  ) {
    return "new";
  }

  if (
    popularRank &&
    popularRank >= rankings.badgeLimits.hotStart &&
    popularRank <= rankings.badgeLimits.hotEnd
  ) {
    return "hot";
  }

  return null;
}

export { gameRankingExcludedIds };
