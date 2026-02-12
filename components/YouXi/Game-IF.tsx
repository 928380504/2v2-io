// 这是if游戏框的区域，涵盖游玩区+控制栏
"use client";

import { useState } from 'react';
import { GameCover } from './IF-Cover';
import { GameControls } from "./IF-Controls";
import { cn } from '@/lib/utils';
import { useRef } from 'react';

interface GameSectionProps {
  gameUrl: string;
  height?: string;
  className?: string;
}

export function GameSection({ gameUrl, height = "675px", className }: GameSectionProps) {
  const [showCover, setShowCover] = useState(true);
  const [isGameLoaded, setIsGameLoaded] = useState(false);
  const [isIframeLoaded, setIsIframeLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
              src={gameUrl}
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
            <GameCover onStart={handleStartGame} />
          )}
        </div>
      </div>

      {/* 控制栏 */}
      <div>
        <GameControls 
          title="Stimulation Clicker"
          likes={328}
          dislikes={42}
          iframeId="gameFrame"
        />
      </div>
    </section>
  );
}