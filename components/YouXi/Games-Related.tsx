"use client";

// 这是首页游戏区中，右侧的相关游戏组件
import Image from 'next/image';
import Link from 'next/link';
import { useRef } from 'react';

interface Game {
  id: string;
  title: string;
  image: string;
  url: string;
  plays?: number;
  rating?: number;
  videoUrl?: string;
}

interface RelatedGamesProps {
  games?: Game[];
}

export const RelatedGames = ({ games = [] }: RelatedGamesProps) => {
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});

  // 处理视频播放
  const handleVideoMouseEnter = (gameId: string) => {
    const video = videoRefs.current[gameId];
    if (video) {
      video.currentTime = 0;
      video.playbackRate = 2.0;
      video.play().catch(error => {
        console.log('Video autoplay failed:', error);
      });
    }
  };

  const handleVideoMouseLeave = (gameId: string) => {
    const video = videoRefs.current[gameId];
    if (video) {
      video.pause();
      video.currentTime = 0;
    }
  };

  return (
    <div className="w-full">
      <div className="grid grid-cols-3 gap-[clamp(6px,0.55vw,10px)] min-[1200px]:grid-cols-6">
        {games?.slice(0, 6).map((game) => (
          <Link 
            key={game.id}
            href={game.url}
            className="group block min-w-0"
            onMouseEnter={() => handleVideoMouseEnter(game.id)}
            onMouseLeave={() => handleVideoMouseLeave(game.id)}
          >
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg shadow-md">
              <Image
                src={game.image}
                alt={game.title}
                fill
                className={`object-cover object-center ${game.videoUrl ? 'min-[1200px]:group-hover:opacity-0' : ''} transition-opacity duration-300`}
                loading="lazy"
                sizes="(max-width: 1199px) 33vw, (max-width: 1439px) 145px, (max-width: 1599px) 160px, (max-width: 1919px) 190px, 255px"
                quality={50}
              />
              {game.videoUrl && (
                <video
                  ref={(el) => {
                    videoRefs.current[game.id] = el;
                  }}
                  className="absolute inset-0 hidden h-full w-full object-cover opacity-0 transition-opacity duration-300 min-[1200px]:block min-[1200px]:group-hover:opacity-100"
                  muted
                  loop
                  playsInline
                  preload="none"
                >
                  <source src={game.videoUrl} type="video/mp4" />
                </video>
              )}
              {/* 标题遮罩 - 只在没有视频的游戏上显示 */}
              {!game.videoUrl && (
                <div className="absolute inset-0 hidden bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity duration-300 min-[1200px]:block min-[1200px]:group-hover:opacity-100">
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
