"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Game, gameCategories } from '@/config/games';
import { Zap } from 'lucide-react';

interface GameSideListZProps {
  games: Game[];
  className?: string;
}

// 获取最新的5个游戏
function getNewestGames(): Game[] {
  const allGames = gameCategories.flatMap(category => 
    category.games.map(game => ({
      ...game,
      category: category.title,
      categoryPath: category.path
    }))
  );

  return allGames
    .sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
      const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
      return dateB.getTime() - dateA.getTime();
    })
    .slice(0, 5);
}

export function GameSideListZ({ className = "" }: GameSideListZProps) {
  const [hoveredGameId, setHoveredGameId] = useState<string | null>(null);
  const newGames = getNewestGames();

  return (
    <div className={`space-y-3 ${className}`}>
      {newGames.map((game) => (
        <div key={game.id} className="relative bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all hover:ring-1 hover:ring-green-500 hover:scale-[1.15] transform duration-200">
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
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent h-8 opacity-0 hover:opacity-100 transition-opacity flex items-end">
              <p className="text-white font-medium text-xs line-clamp-1 px-2 pb-1.5">
                {game.title}
              </p>
            </div>
          </Link>

          {/* New标签 */}
          <div className="absolute top-1.5 right-1.5">
            <div className="flex items-center gap-0.5 bg-green-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
              <Zap className="w-2.5 h-2.5" />
              <span>New</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}