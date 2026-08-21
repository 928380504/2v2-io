"use client";

import Image from "next/image";
import Link from "next/link";
import type { Game } from "@/config/game-catalog";
import {
  getGameRankingBadge,
  isGameRankingEligible,
  type GameRankingBadge,
} from "@/config/popular-games";
import { useGlobalGameRankings } from "@/hooks/use-global-game-rankings";
import styles from "./SquareGameRecommendations.module.css";

type RecommendationBadge = GameRankingBadge;

interface SquareGameRecommendationsProps {
  games: readonly Game[];
  currentGameId?: string;
  excludeGameIds?: readonly string[];
  limit?: number;
  ariaLabel?: string;
  className?: string;
}

const BADGE_STYLES: Record<RecommendationBadge, string> = {
  hot: styles.hot,
  new: styles.new,
  top: styles.top,
};

const BADGE_LABELS: Record<RecommendationBadge, string> = {
  hot: "Hot",
  new: "New",
  top: "Top",
};

export function SquareGameRecommendations({
  games,
  currentGameId,
  excludeGameIds = [],
  limit = 4,
  ariaLabel = "Recommended games",
  className = "",
}: SquareGameRecommendationsProps) {
  const globalRankings = useGlobalGameRankings();
  const excludedIds = new Set(excludeGameIds);
  if (currentGameId) excludedIds.add(currentGameId);

  const seenIds = new Set<string>();
  const visibleGames = games
    .filter((game) => {
      if (
        excludedIds.has(game.id) ||
        seenIds.has(game.id) ||
        !isGameRankingEligible(game.id)
      ) {
        return false;
      }

      seenIds.add(game.id);
      return true;
    })
    .slice(0, Math.max(0, limit));

  if (visibleGames.length === 0) return null;

  return (
    <section aria-label={ariaLabel} className={className}>
      <div className={styles.grid}>
        {visibleGames.map((game) => {
          const badge = getGameRankingBadge(game, globalRankings);

          return (
            <Link
              key={game.id}
              href={game.url}
              aria-label={`Play ${game.title}`}
              title={game.title}
              className={styles.card}
            >
              <span className={styles.visual}>
                <Image
                  src={game.image}
                  alt={`Play ${game.title}`}
                  fill
                  sizes="(min-width: 1920px) 150px, (min-width: 1536px) 110px, (min-width: 1200px) 160px, 84px"
                  className={styles.image}
                />

                <span
                  aria-hidden="true"
                  className={styles.overlay}
                />

                <span className={styles.title}>
                  <span className={styles.titleText}>{game.title}</span>
                </span>
              </span>

              {badge && (
                <span
                  className={`${styles.badge} ${BADGE_STYLES[badge]}`}
                >
                  {BADGE_LABELS[badge]}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
