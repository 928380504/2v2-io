"use client";

import { useMemo } from "react";
import { TrendingUp } from "lucide-react";
import { GameCard } from "@/components/templates/GameCard";
import type { Game } from "@/config/game-catalog";
import { useGlobalGameRankings } from "@/hooks/use-global-game-rankings";

interface LiveGameCardsProps {
  games: Game[];
  ranked?: boolean;
  orderByPopularity?: boolean;
  limit?: number;
}

export function LiveGameCards({
  games,
  ranked = false,
  orderByPopularity = false,
  limit,
}: LiveGameCardsProps) {
  const globalRankings = useGlobalGameRankings();
  const items = globalRankings.stats;
  const visibleGames = useMemo(() => {
    const orderedGames = orderByPopularity
      ? [...games].sort(
          (left, right) =>
            (globalRankings.popularRankById.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
            (globalRankings.popularRankById.get(right.id) ?? Number.MAX_SAFE_INTEGER),
        )
      : games;

    return typeof limit === "number" ? orderedGames.slice(0, limit) : orderedGames;
  }, [games, globalRankings.popularRankById, limit, orderByPopularity]);

  if (!ranked) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {visibleGames.map((game) => (
          <div
            key={game.id}
            className="transform transition-transform duration-200 hover:scale-105"
          >
            <GameCard game={game} engagementStats={items[game.id]} showLiveMetrics />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 lg:gap-6">
      {visibleGames.map((game, index) => (
        <div
          key={game.id}
          className={`transform transition-all duration-300 hover:scale-105 ${
            index < 3
              ? "lg:col-span-2 lg:row-span-2 lg:mx-auto lg:w-[calc(80%-1rem)]"
              : ""
          }`}
        >
          <div className="relative">
            <GameCard game={game} engagementStats={items[game.id]} showLiveMetrics />
            {(globalRankings.popularRankById.get(game.id) ?? Infinity) <= 3 && (
              <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-orange-500 px-2 py-1 text-sm font-medium text-white shadow-lg">
                <TrendingUp className="h-4 w-4" />
                <span>#{globalRankings.popularRankById.get(game.id)} Trending</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
