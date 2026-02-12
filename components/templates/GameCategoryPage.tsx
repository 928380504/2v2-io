"use client";

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Game } from '@/config/games';
import { Star, TrendingUp, Clock, Users } from 'lucide-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// 获取排序后的游戏列表
function getSortedGames(games: Game[], sortBy: 'popular' | 'rating' | 'newest' | 'trending'): Game[] {
  return [...games].sort((a, b) => {
    switch (sortBy) {
      case 'popular':
        return (b.plays || 0) - (a.plays || 0);
      case 'rating':
        return (b.rating || 0) - (a.rating || 0);
      case 'trending':
        // 这里可以添加趋势算法，暂时使用播放量
        return (b.plays || 0) - (a.plays || 0);
      case 'newest':
        const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
        const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
        return dateB.getTime() - dateA.getTime();
      default:
        return 0;
    }
  });
}

interface GameCardProps {
  game: Game;
}

export function GameCard({ game }: GameCardProps) {
  return (
    <Link 
      href={game.url}
      className="block group"
    >
      <div className="bg-white dark:bg-green-800 rounded-lg shadow-md hover:shadow-xl dark:shadow-green-900/50 dark:hover:shadow-green-900/70 overflow-hidden 
        transition-all duration-300 ease-out transform hover:scale-105"
      >
        <div className="relative aspect-[16/9]">
          <Image
            src={game.image.replace('-logo.webp', '-bj.webp')}
            alt={game.title}
            fill
            className="object-cover"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
            <div className="transform scale-75 group-hover:scale-100 transition-transform duration-300">
              <svg 
                className="w-12 h-12 text-white" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <polygon 
                  points="10 8 16 12 10 16 10 8" 
                  fill="currentColor" 
                  stroke="none"
                />
              </svg>
            </div>
          </div>
        </div>
        <div className="p-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1 line-clamp-1 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
            {game.title}
          </h3>
          {game.description && (
            <p className="text-gray-600 dark:text-gray-300 text-xs mb-2 line-clamp-1">
              {game.description}
            </p>
          )}
          <div className="flex items-center justify-between text-xs">
            {game.plays && (
              <span className="text-gray-500 dark:text-gray-400">
                {new Intl.NumberFormat().format(game.plays)} plays
              </span>
            )}
            {game.rating && (
              <span className="text-yellow-500 flex items-center gap-0.5">
                <svg className="w-3 h-3 fill-current" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                {game.rating.toFixed(1)}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

interface GameCategoryPageProps {
  title: string;
  description: string;
  games: Game[];
}

const GAMES_PER_PAGE = 18; // 每页3行，每行6个，共18个游戏

export function GameCategoryPage({ title, description, games }: GameCategoryPageProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'popular' | 'rating' | 'newest' | 'trending'>('popular');
  
  // 先排序，再分页
  const sortedGames = useMemo(() => getSortedGames(games, sortBy), [games, sortBy]);
  const totalPages = Math.ceil(sortedGames.length / GAMES_PER_PAGE);
  const currentGames = sortedGames.slice(
    (currentPage - 1) * GAMES_PER_PAGE,
    currentPage * GAMES_PER_PAGE
  );

  return (
    <main className="flex-1 px-4 py-8">
      <div className="max-w-[1200px] mx-auto">
        {/* 标题部分 */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            {title}
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            {description}
          </p>
        </div>

        {/* 排序选项 */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setSortBy('popular')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors
              ${sortBy === 'popular' ? 'bg-green-600 text-white' : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
          >
            <Users className="w-4 h-4" />
            Popular
          </button>
          <button
            onClick={() => setSortBy('rating')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors
              ${sortBy === 'rating' ? 'bg-green-600 text-white' : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
          >
            <Star className="w-4 h-4" />
            Rating
          </button>
          <button
            onClick={() => setSortBy('trending')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors
              ${sortBy === 'trending' ? 'bg-green-600 text-white' : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
          >
            <TrendingUp className="w-4 h-4" />
            Trending
          </button>
          <button
            onClick={() => setSortBy('newest')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors
              ${sortBy === 'newest' ? 'bg-green-600 text-white' : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
          >
            <Clock className="w-4 h-4" />
            Newest
          </button>
        </div>

        {/* 游戏列表 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
          {currentGames.map((game) => (
            <div key={game.id} className="transform hover:scale-105 transition-transform duration-200">
              <GameCard game={game} />
            </div>
          ))}
        </div>

        {/* 分页控制 */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 mt-8">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 disabled:opacity-50 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors
                    ${currentPage === page 
                      ? 'bg-green-600 text-white' 
                      : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                >
                  {page}
                </button>
              ))}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 disabled:opacity-50 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </main>
  );
}