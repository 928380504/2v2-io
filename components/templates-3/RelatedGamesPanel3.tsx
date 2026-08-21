"use client";

import Image from "next/image";
import Link from "next/link";
import { SITE_ROUTES } from "@/config/routes";
import { ArrowUpRight, ChevronUp } from "lucide-react";
import { useMemo, useState } from "react";
import type { Game } from "@/config/game-catalog";
import { GameTags } from "@/components/All/GameTags";
import { useGameRating } from "@/hooks/use-game-rating";
import { useGlobalGameRankings } from "@/hooks/use-global-game-rankings";
import { getPublicRatingCount } from "@/lib/game-rating-store";
import { getPrimaryGameAttributeLabels } from "@/config/game-filters";

interface RelatedGamesPanelProps {
  games: Game[];
  currentGameId: string;
  className?: string;
}

interface RankedGame {
  game: Game;
  rank: number;
}

type GameRankingType = "popular" | "new";

const COLLAPSED_GAME_COUNT = 6;

function getCollapsedGames(
  rankedGames: RankedGame[],
  currentGameId: string,
) {
  if (rankedGames.length <= COLLAPSED_GAME_COUNT) return rankedGames;

  const currentIndex = rankedGames.findIndex(
    ({ game }) => game.id === currentGameId,
  );
  if (currentIndex < COLLAPSED_GAME_COUNT || currentIndex < 0) {
    return rankedGames.slice(0, COLLAPSED_GAME_COUNT);
  }

  const maximumWindowStart = Math.max(3, rankedGames.length - 3);
  const windowStart = Math.min(
    Math.max(3, currentIndex - 1),
    maximumWindowStart,
  );
  return [
    ...rankedGames.slice(0, 3),
    ...rankedGames.slice(windowStart, windowStart + 3),
  ];
}

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    const medals = ["🥇", "🥈", "🥉"];
    const labels = ["Gold medal", "Silver medal", "Bronze medal"];
    return (
      <span
        role="img"
        aria-label={`${labels[rank - 1]}, rank ${rank}`}
        title={`Rank ${rank}`}
        className="text-base leading-none"
      >
        {medals[rank - 1]}
      </span>
    );
  }

  return (
    <span
      aria-label={`Rank ${rank}`}
      title={`Rank ${rank}`}
      className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-green-100 px-1 text-[9px] font-black tabular-nums text-green-700 dark:bg-green-800/70 dark:text-green-100"
    >
      {rank}
    </span>
  );
}

function GameRatingBadge({ game }: { game: Game }) {
  const rating = useGameRating(game.id, {
    score: game.rating ?? 0,
    votes: game.ratingCount ?? 0,
  });
  const normalizedScore = Math.min(5, Math.max(0, rating.score));
  const ratingProgress = `${(normalizedScore / 5) * 100}%`;
  const publicRatingCount = getPublicRatingCount(rating.votes);
  const voteLabel = ` from ${publicRatingCount} ratings`;

  return (
    <span
      aria-label={`Rating ${normalizedScore.toFixed(1)} out of 5${voteLabel}`}
      title={`Rating: ${normalizedScore.toFixed(1)} / 5${voteLabel}`}
      className="popular-game-rating inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full p-[4px]"
      style={{
        backgroundImage: `conic-gradient(var(--popular-rating-active) ${ratingProgress}, var(--popular-rating-track) ${ratingProgress})`,
      }}
    >
      <span className="inline-flex h-full w-full items-center justify-center rounded-full bg-white text-[9px] font-black tabular-nums text-gray-600 dark:bg-[#0d4021] dark:text-gray-400">
        {normalizedScore.toFixed(1)}
      </span>
    </span>
  );
}

export function RelatedGamesPanel({
  games,
  currentGameId,
  className = "",
}: RelatedGamesPanelProps) {
  const [isFullRanking, setIsFullRanking] = useState(false);
  const [rankingType, setRankingType] = useState<GameRankingType>("popular");
  const uniqueGames = useMemo(
    () => Array.from(new Map(games.map((game) => [game.id, game])).values()),
    [games],
  );
  const globalRankings = useGlobalGameRankings();
  const rankedGames = useMemo<RankedGame[]>(() => {
    const rankById = rankingType === "popular"
      ? globalRankings.popularRankById
      : globalRankings.newRankById;
    return uniqueGames
      .flatMap((game) => {
        const rank = rankById.get(game.id);
        return rank ? [{ game, rank }] : [];
      })
      .sort((left, right) => left.rank - right.rank);
  }, [
    globalRankings.newRankById,
    globalRankings.popularRankById,
    rankingType,
    uniqueGames,
  ]);

  const handleRankingTypeChange = (nextRankingType: GameRankingType) => {
    setRankingType(nextRankingType);
    setIsFullRanking(false);
  };

  const displayedGames = isFullRanking
    ? rankedGames
    : getCollapsedGames(rankedGames, currentGameId);

  return (
    <aside
      aria-label={rankingType === "popular" ? "Popular games ranking" : "New games ranking"}
      className={`related-games-panel flex h-full min-h-0 flex-col overflow-hidden rounded-tr-3xl bg-white/95 shadow-[0_12px_34px_rgba(21,128,61,0.13)] backdrop-blur-sm dark:bg-[#0d4021] dark:shadow-[0_12px_34px_rgba(0,0,0,0.28)] ${className}`}
    >
      <div className="shrink-0 border-b border-green-100 px-3 py-2.5 dark:border-green-700/50">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5 text-base font-black uppercase tracking-tight text-gray-900 dark:text-white">
            <span aria-hidden="true" className="text-xl leading-none">
              🔥
            </span>
            Top games
          </div>

          <Link
            href={SITE_ROUTES.gameCategory}
            aria-label="View all games"
            title="View all games"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-green-100 bg-green-50 text-green-700 transition hover:border-green-200 hover:bg-green-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500/60 dark:border-green-700/60 dark:bg-green-900/50 dark:text-green-200 dark:hover:bg-green-800/70"
          >
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>

        <div className="mt-2 grid grid-cols-2 rounded-lg bg-green-50 p-1 dark:bg-green-950/40">
          <button
            type="button"
            onClick={() => handleRankingTypeChange("popular")}
            className={`rounded-md px-1.5 py-1.5 text-[10px] font-bold transition ${
              rankingType === "popular"
                ? "bg-white text-green-700 shadow-sm dark:bg-green-700 dark:text-white"
                : "text-gray-500 hover:text-green-700 dark:text-gray-300 dark:hover:text-white"
            }`}
          >
            Popular
          </button>
          <button
            type="button"
            onClick={() => handleRankingTypeChange("new")}
            className={`rounded-md px-1.5 py-1.5 text-[10px] font-bold transition ${
              rankingType === "new"
                ? "bg-white text-green-700 shadow-sm dark:bg-green-700 dark:text-white"
                : "text-gray-500 hover:text-green-700 dark:text-gray-300 dark:hover:text-white"
            }`}
          >
            New
          </button>
        </div>
      </div>

      <ol
        className={`relative flex min-h-0 flex-1 flex-col ${
          isFullRanking
            ? "leaderboard-ranking-scrollbar overflow-y-scroll overscroll-contain"
            : "overflow-hidden"
        }`}
      >
        {displayedGames.map(({ game, rank }) => {
          const isCurrentGame = game.id === currentGameId;
          return (
            <li
              key={game.id}
              className={`group relative min-h-0 border-b border-green-100 last:border-b-0 dark:border-green-700/50 ${
                isFullRanking ? "h-[72px] shrink-0" : "flex-1"
              } ${
                isCurrentGame
                  ? "bg-green-50/90 before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-green-500 dark:bg-green-800/30"
                  : ""
              }`}
            >
              <Link
                href={game.url}
                title={`Play ${game.title}`}
                aria-current={isCurrentGame ? "page" : undefined}
                className="popular-game-link flex h-full min-h-0 items-center gap-2 px-2.5 py-1.5 transition-colors hover:bg-green-50/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green-500/60 dark:hover:bg-green-800/25"
              >
                <div className="popular-game-rank flex w-5 shrink-0 justify-center">
                  <RankBadge rank={rank} />
                </div>

                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-100 shadow-sm dark:bg-gray-800 min-[1720px]:h-14 min-[1720px]:w-14">
                  <Image
                    src={game.image}
                    alt={game.title}
                    fill
                    sizes="(min-width: 1720px) 56px, 48px"
                    quality={60}
                    loading="lazy"
                    className="object-contain transition-transform duration-300 group-hover:scale-105"
                  />
                </div>

                <div className="popular-game-info min-w-0 flex-1 overflow-hidden">
                  <div className="flex min-w-0 items-center gap-1">
                    <h3
                      title={game.title}
                      className="popular-game-title min-w-0 truncate text-[10px] font-extrabold leading-tight text-gray-800 transition-colors group-hover:text-green-700 dark:text-gray-100 dark:group-hover:text-green-200 min-[1440px]:text-[11px]"
                    >
                      {game.title}
                    </h3>
                    {isCurrentGame && (
                      <span className="shrink-0 rounded-full bg-green-600 px-1 py-px text-[7px] font-black leading-none text-white">
                        YOU
                      </span>
                    )}
                  </div>

                  <GameTags
                    tags={getPrimaryGameAttributeLabels(game)}
                    className="popular-game-tags mt-1"
                  />
                </div>

                <GameRatingBadge game={game} />

              </Link>
            </li>
          );
        })}
      </ol>

      <div className="relative flex h-11 shrink-0 items-center justify-center border-t border-green-100 bg-transparent px-3 pt-1.5 dark:border-green-700/50">
        <span className="text-center text-[8px] font-semibold text-gray-400 dark:text-gray-400 min-[1440px]:text-[9px]">
          {rankedGames.length} games ranked
        </span>
        <button
          type="button"
          onClick={() => setIsFullRanking((expanded) => !expanded)}
          aria-expanded={isFullRanking}
          aria-label={isFullRanking ? "Collapse game ranking" : "View full game ranking"}
          title={isFullRanking ? "Collapse ranking" : "View full ranking"}
          className="absolute left-1/2 top-0 inline-flex h-5 min-w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-green-100 bg-white px-2 text-[9px] font-black tracking-[0.18em] text-green-500 shadow-sm transition hover:border-green-300 hover:bg-green-50 hover:text-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500/60 dark:border-green-700 dark:bg-[#0d4021] dark:text-green-300 dark:hover:bg-green-800/70 dark:hover:text-white"
        >
          {isFullRanking ? (
            <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            "•••"
          )}
        </button>
      </div>
    </aside>
  );
}
