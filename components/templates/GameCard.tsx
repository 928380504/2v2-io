"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart, Play, Star, ThumbsUp } from "lucide-react";
import type { Game } from "@/config/game-catalog";
import type { GameCardStats } from "@/hooks/use-game-card-stats";
import { useGameRating } from "@/hooks/use-game-rating";

interface GameCardProps {
  game: Game;
  engagementStats?: GameCardStats;
  showLiveMetrics?: boolean;
}

const CARD_METRICS = [
  { key: "plays", label: "Plays", icon: Play, color: "text-emerald-600 dark:text-emerald-300" },
  { key: "likes", label: "Likes", icon: ThumbsUp, color: "text-sky-600 dark:text-sky-300" },
  { key: "favorites", label: "Favorites", icon: Heart, color: "text-rose-500 dark:text-rose-300" },
] as const;

function formatCompactCount(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function GameCard({
  game,
  engagementStats,
  showLiveMetrics = true,
}: GameCardProps) {
  const liveRating = useGameRating(game.id, {
    score: game.rating ?? 0,
    votes: game.ratingCount ?? 0,
  });
  const livePlayCount = engagementStats?.plays ?? game.plays;

  return (
    <Link href={game.url} className="group block">
      <div className="overflow-hidden rounded-lg bg-white shadow-md transition-all duration-300 ease-out hover:scale-105 hover:shadow-xl dark:bg-green-800 dark:shadow-green-900/50 dark:hover:shadow-green-900/70">
        <div className="relative aspect-[16/9]">
          <Image
            src={game.image.replace("-logo.webp", "-bj.webp")}
            alt={game.title}
            fill
            sizes="(max-width: 639px) 50vw, (max-width: 767px) 33vw, (max-width: 1023px) 25vw, 200px"
            className="object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <div className="scale-75 transition-transform duration-300 group-hover:scale-100">
              <svg
                className="h-12 w-12 text-white"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none" />
              </svg>
            </div>
          </div>
        </div>

        <div className="p-3">
          <h3 className="mb-1 line-clamp-1 text-sm font-semibold text-gray-900 transition-colors group-hover:text-green-600 dark:text-white dark:group-hover:text-green-400">
            {game.title}
          </h3>
          {game.description && (
            <p className="mb-2 line-clamp-1 text-xs text-gray-600 dark:text-gray-300">
              {game.description}
            </p>
          )}

          {showLiveMetrics ? (
            <div className="grid grid-cols-4 gap-1 border-t border-gray-100 pt-2 text-[10px] dark:border-green-700/45">
              {CARD_METRICS.map(({ key, label, icon: Icon, color }) => {
                const value = engagementStats?.[key];
                return (
                  <span
                    key={key}
                    title={value === undefined ? `${label}: loading` : `${label}: ${value}`}
                    aria-label={value === undefined ? `${label} loading` : `${label}: ${value}`}
                    className="flex min-w-0 items-center justify-center gap-0.5 text-gray-500 dark:text-gray-300"
                  >
                    <Icon className={`h-3 w-3 shrink-0 ${color}`} aria-hidden="true" />
                    <span className="truncate tabular-nums">
                      {value === undefined ? "—" : formatCompactCount(value)}
                    </span>
                  </span>
                );
              })}
              <span
                title={`Rating: ${liveRating.score.toFixed(1)}`}
                aria-label={`Rating: ${liveRating.score.toFixed(1)}`}
                className="flex min-w-0 items-center justify-center gap-0.5 text-gray-500 dark:text-gray-300"
              >
                <Star className="h-3 w-3 shrink-0 fill-yellow-400 text-yellow-500" aria-hidden="true" />
                <span className="truncate tabular-nums">{liveRating.score.toFixed(1)}</span>
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between text-xs">
              {livePlayCount ? (
                <span className="text-gray-500 dark:text-gray-400">
                  {new Intl.NumberFormat().format(livePlayCount)} plays
                </span>
              ) : (
                <span aria-hidden="true" />
              )}
              {liveRating.score > 0 && (
                <span className="flex items-center gap-0.5 text-yellow-500">
                  <Star className="h-3 w-3 fill-current" aria-hidden="true" />
                  {liveRating.score.toFixed(1)}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
