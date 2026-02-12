// 这是正方形的游戏展示组件
"use client";

import Link from "next/link";
import Image from "next/image";
import { gameCategories } from "@/config/games";
import { useMemo, useState, useEffect } from "react";

interface HotYouxiProps {
  className?: string;
}

export function HotYouxi({ className = "" }: HotYouxiProps) {
  const [games, setGames] = useState(() => {
    // 获取所有分类的所有游戏
    const allGames = gameCategories.flatMap(category => category.games);
    // 随机打乱所有游戏
    const shuffledGames = [...allGames].sort(() => Math.random() - 0.5);
    // 取前24个
    return shuffledGames.slice(0, 24);
  });

  useEffect(() => {
    // 每次组件挂载时重新随机
    const allGames = gameCategories.flatMap(category => category.games);
    const shuffledGames = [...allGames].sort(() => Math.random() - 0.5);
    setGames(shuffledGames.slice(0, 24));
  }, []);

  return (
    <div className={`py-1.5 ${className}`}>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12 gap-3 place-items-center">
        {games.map((game) => (
          <Link
            key={game.id}
            href={game.url}
            className="group"
            title={`Play ${game.title} - Online Clicker Games`}
          >
            <div className="relative w-[80px] h-[80px] rounded-xl overflow-hidden bg-gray-200 dark:bg-gray-800 md:transform md:transition-all md:duration-300 md:group-hover:scale-105 md:group-hover:-translate-y-1 md:hover:shadow-lg">
              <Image
                src={game.image}
                alt={`${game.title} - Free Clicker Games`}
                fill
                className="object-cover md:transition-transform md:duration-300"
                sizes="100px"
                priority={false}
              />
              {/* Title overlay - 只在桌面端显示 */}
              <div className="absolute inset-0 bg-black/40 opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 hidden md:flex items-center justify-center backdrop-blur-[2px]">
                <p className="text-white text-xs font-medium text-center px-2 line-clamp-2">
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