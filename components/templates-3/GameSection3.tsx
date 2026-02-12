"use client";

import { useState, useEffect, useRef } from 'react';
import { Game } from '@/config/games';
import { GameCover } from './GameCover3';
import { GameControls } from "../YouXi/IF-Controls";
import { cn } from '@/lib/utils';

interface GameSectionProps {
  game: Game & { playUrl: string };
  height?: string;
  className?: string;
  autoLoad?: boolean; // 新增自动加载选项
}

export function GameSection({ game, height = "675px", className, autoLoad = false }: GameSectionProps) {
  const [showCover, setShowCover] = useState(!autoLoad); // 如果自动加载，则不显示封面
  const [isGameLoaded, setIsGameLoaded] = useState(autoLoad); // 如果自动加载，则立即加载游戏
  const [isIframeLoaded, setIsIframeLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 自动加载逻辑
  useEffect(() => {
    if (autoLoad) {
      // 如果设置了自动加载，立即加载iframe
      setIsGameLoaded(true);
      setShowCover(false);
    }
  }, [autoLoad]);

  const handleStartGame = () => {
    setShowCover(false);
    setIsGameLoaded(true);
  };

  return (
    <section className={cn("relative", className)}>
      {/* 游戏容器 */}
      <div className="bg-white/80 dark:bg-[#0d4021] backdrop-blur-sm rounded-tl-3xl overflow-hidden">
        <div 
          ref={containerRef}
          className="relative overflow-hidden bg-white/80 dark:bg-[#0d4021] backdrop-blur-sm" 
          style={{ height }}
        >
          {isGameLoaded && (
            <iframe
              id="gameFrame"
              src={game.playUrl}
              className="w-full h-full relative z-10"
              style={{ 
                visibility: showCover ? 'hidden' : 'visible',
                border: 'none'
              }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              onLoad={() => setIsIframeLoaded(true)}
            />
          )}
          
          {showCover && (
            <GameCover 
              onStart={handleStartGame}
              gameTitle={game.title}
              gameDescription={game.description}
              gameImage={game.image}
              gameBgImage={game.image.replace('-logo.webp', '-bj.webp')}
            />
          )}
        </div>
      </div>

      {/* 控制栏 */}
      <div className="mt-[2px]">
        <GameControls 
          title={game.title}
          likes={328}
          dislikes={42}
          iframeId="gameFrame"
        />
      </div>
    </section>
  );
}