/** Games that remain playable but must not appear in either game ranking. */
export const gameRankingExcludedIds = new Set<string>([]);
export function isGameRankingEligible(gameId: string): boolean { return !gameRankingExcludedIds.has(gameId); }
