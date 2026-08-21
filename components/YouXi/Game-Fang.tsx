"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { gameCategories, seededRandom } from "@/config/game-catalog";

interface HotYouxiProps {
  className?: string;
}

export function HotYouxi({ className = "" }: HotYouxiProps) {
  const games = useMemo(() => {
    const allGames = gameCategories.flatMap((category) => category.games);
    return [...allGames]
      .map((game) => ({
        game,
        key: seededRandom(`hotyouxi-v1:${game.id}`),
      }))
      .sort((a, b) => a.key - b.key || a.game.id.localeCompare(b.game.id))
      .slice(0, 16)
      .map(({ game }) => game);
  }, []);

  return (
    <div className={`hot-games-density-container py-0 ${className}`}>
      <div className="grid grid-cols-[repeat(auto-fit,90px)] justify-center gap-3">
        {games.map((game) => (
          <Link
            key={game.id}
            href={game.url}
            className="hot-game-density-item group hidden"
            title={`Play ${game.title} - Online Clicker Games`}
          >
            <div className="relative h-[90px] w-[90px] overflow-hidden rounded-xl bg-gray-200 dark:bg-gray-800 md:transform md:transition-all md:duration-300 md:group-hover:scale-105 md:group-hover:-translate-y-1 md:hover:shadow-lg">
              <Image
                src={game.image}
                alt={`${game.title} - Free Clicker Games`}
                fill
                className="object-cover md:transition-transform md:duration-300"
                sizes="90px"
                priority={false}
              />

              <div className="absolute inset-0 hidden items-center justify-center bg-black/40 opacity-0 backdrop-blur-[2px] transition-opacity duration-300 md:flex md:group-hover:opacity-100">
                <p className="line-clamp-2 px-2 text-center text-xs font-medium text-white">
                  {game.title}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>

    </div>
  );
}
