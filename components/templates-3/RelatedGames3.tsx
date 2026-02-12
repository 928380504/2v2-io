"use client"; // 明确标记为客户端组件

import Image from 'next/image';
import Link from 'next/link';
import { useRef, useState, useEffect, useMemo } from 'react';
import type { Game } from '@/config/games';

interface RelatedGamesProps {
  games: Game[];
}

// 星星评分组件
const StarRating = ({ rating }: { rating: number }) => {
  // 生成5个星星，根据评分填充
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => {
        const difference = rating - star;
        return (
          <svg 
            key={star} 
            className="w-4 h-4" 
            fill={difference >= -0.2 ? "#FBBF24" : "#E5E7EB"} 
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        );
      })}
      <span className="text-sm text-muted-foreground ml-1">
        {rating.toFixed(1)}
      </span>
    </div>
  );
};

export const RelatedGames = ({ games }: RelatedGamesProps) => {
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});
  const [loadedVideos, setLoadedVideos] = useState<{ [key: string]: boolean }>({});
  const [isBrowser, setIsBrowser] = useState(false);
  const [currentPath, setCurrentPath] = useState('');
  
  // 确保只在客户端执行
  useEffect(() => {
    setIsBrowser(true);
    setCurrentPath(window.location.pathname);
  }, []);
  
  // 在同一分类下随机排序并限制显示数量为6个
  const displayGames = useMemo(() => {
    if (!isBrowser) return games.slice(0, 6); // 服务器端渲染时简单返回前6个
    
    // 排除当前游戏
    const currentGameId = currentPath.split('/').pop();
    const filteredGames = games.filter(game => game.id !== currentGameId);
    
    return filteredGames
      .sort(() => Math.random() - 0.5)
      .slice(0, 6);
  }, [games, isBrowser, currentPath]);

  const handleVideoMouseEnter = (gameId: string) => {
    if (!isBrowser) return;
    
    const video = videoRefs.current[gameId];
    if (video && loadedVideos[gameId]) {
      video.currentTime = 0;
      video.play().catch(() => {
        // 如果播放失败，保持显示背景图片
        setLoadedVideos(prev => ({ ...prev, [gameId]: false }));
      });
    }
  };

  const handleVideoMouseLeave = (gameId: string) => {
    if (!isBrowser) return;
    
    const video = videoRefs.current[gameId];
    if (video) {
      video.pause();
      video.currentTime = 0;
    }
  };

  const handleVideoLoad = (gameId: string) => {
    if (!isBrowser) return;
    setLoadedVideos(prev => ({ ...prev, [gameId]: true }));
  };

  return (
    <div className="w-full xl:w-[150px]">
      <div className="grid grid-cols-3 gap-3 xl:grid-cols-1">
        {displayGames.map((game) => (
          <Link 
            key={game.id}
            href={game.url || '#'}
            className="group block"
            onMouseEnter={() => handleVideoMouseEnter(game.id)}
            onMouseLeave={() => handleVideoMouseLeave(game.id)}
          >
            <div className="relative aspect-[16/9] overflow-hidden rounded-lg shadow-md">
              <Image
                src={game.image ? game.image.replace('-logo.webp', '-bj.webp') : '/placeholder.jpg'}
                alt={game.title || 'Game'}
                fill
                className={`absolute inset-0 w-full h-full object-cover object-center ${game.videoUrl && loadedVideos[game.id] ? 'xl:group-hover:opacity-0' : ''} transition-opacity duration-300`}
                loading="lazy"
                sizes="(max-width: 1280px) 33vw, 150px"
                quality={85}
              />
              {isBrowser && game.videoUrl && (
                <video
                  ref={(el) => videoRefs.current[game.id] = el}
                  className={`absolute inset-0 w-full h-full object-cover ${loadedVideos[game.id] ? 'opacity-0 xl:group-hover:opacity-100' : 'opacity-0'} transition-opacity duration-300 hidden xl:block`}
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  onLoadedData={() => handleVideoLoad(game.id)}
                >
                  <source src={game.videoUrl} type="video/mp4" />
                </video>
              )}
              {/* 只在没有视频时显示游戏名称和遮罩 */}
              {(!game.videoUrl || !loadedVideos[game.id]) && (
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 xl:group-hover:opacity-100 transition-opacity duration-300 hidden xl:block">
                  <div className="absolute bottom-2 left-2 right-2">
                    <h3 className="text-white text-sm font-medium line-clamp-2">
                      {game.title}
                    </h3>
                  </div>
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};