"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Game } from '@/config/game-catalog';
import { getGameRankingBadge } from '@/config/popular-games';
import { useGlobalGameRankings } from '@/hooks/use-global-game-rankings';

interface GameSideListYProps {
  games: Game[];
  className?: string;
}

export function GameSideListY({ games, className = "" }: GameSideListYProps) {
  const [hoveredGameId, setHoveredGameId] = useState<string | null>(null);
  const globalRankings = useGlobalGameRankings();
  const availableIds = games.length > 0
    ? new Set(games.map((game) => game.id))
    : null;
  const hotGames = globalRankings.popular
    .filter(({ game }) => !availableIds || availableIds.has(game.id))
    .slice(0, 5);

  return (
    <div className={`space-y-3 ${className}`}>
      {hotGames.map(({ game }) => {
        const badge = getGameRankingBadge(game, globalRankings);
        const badgeClass = badge === 'top'
          ? 'bg-amber-400 text-amber-950'
          : badge === 'new'
            ? 'bg-violet-500 text-white'
            : 'bg-red-500 text-white';

        return (
        <div key={game.id} className="group relative bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all hover:ring-1 hover:ring-green-500 hover:scale-[1.08] transform duration-200">
          <Link 
            href={game.url}
            className="block"
            title={game.title}
            onMouseEnter={() => setHoveredGameId(game.id)}
            onMouseLeave={() => setHoveredGameId(null)}
          >
            {/* 游戏封面图 */}
            <div className="relative w-full aspect-[16/9] rounded-lg overflow-hidden">
              <Image
                src={game.image.replace('-logo.webp', '-bj.webp')}
                alt={`${game.title} background`}
                fill
                className="object-cover transition-opacity duration-300"
              />
              {hoveredGameId === game.id && game.videoUrl && (
                <video 
                  className="absolute inset-0 w-full h-full object-cover"
                  loop
                  autoPlay
                  muted
                  playsInline
                  onError={(e) => {
                    // 视频加载失败时隐藏视频元素
                    const target = e.target as HTMLVideoElement;
                    target.style.display = 'none';
                  }}
                >
                  <source src={game.videoUrl} type="video/mp4" />
                </video>
              )}
            </div>

            {/* 游戏信息悬浮层 */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-8 items-end bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100">
              <p className="text-white font-medium text-xs line-clamp-1 px-2 pb-1.5">
                {game.title}
              </p>
            </div>
          </Link>

          {badge && (
            <div className="absolute top-1.5 right-1.5">
              <div className={`rounded-full px-1.5 py-0.5 text-[10px] font-black uppercase ${badgeClass}`}>
                {badge}
              </div>
            </div>
          )}
        </div>
        );
      })}
    </div>
  );
}
