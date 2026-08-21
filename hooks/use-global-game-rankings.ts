"use client";

import { useMemo } from "react";
import { getAllGames } from "@/config/game-catalog";
import {
  createGlobalGameRankingSnapshot,
  isGameRankingEligible,
} from "@/config/popular-games";
import { useGameCardStats } from "@/hooks/use-game-card-stats";

const GLOBAL_RANKABLE_GAMES = getAllGames().filter((game) =>
  isGameRankingEligible(game.id),
);
const GLOBAL_RANKABLE_GAME_IDS = GLOBAL_RANKABLE_GAMES.map((game) => game.id);

export function useGlobalGameRankings() {
  const { items, isRefreshing } = useGameCardStats(GLOBAL_RANKABLE_GAME_IDS);
  const rankings = useMemo(
    () => createGlobalGameRankingSnapshot(GLOBAL_RANKABLE_GAMES, items),
    [items],
  );

  return {
    ...rankings,
    stats: items,
    isRefreshing,
  };
}
