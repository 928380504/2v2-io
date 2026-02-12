// 这是首页游戏区中，右侧的相关游戏组件
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef, useState, useEffect } from 'react';

interface Game {
  id: string;
  title: string;
  image: string;
  url: string;
  plays?: number;
  rating?: number;
  videoUrl?: string;
}

export const defaultGames: Game[] = [
   {
    id: 'planet-clicker',
    title: 'Planet Clicker',
    image: '/planet-clicker-bj.webp',
    url: '/sci-fi-clicker-games/planet-clicker',
    plays: 920000,
    rating: 4.8,
  },
  {
    id: 'planet-clicker-2',
    title: 'Planet Clicker 2',
    image: '/planet-clicker-2-bj.webp',
    url: '/sci-fi-clicker-games/planet-clicker-2',
    plays: 950000,
    rating: 4.9,
 
  },

  {
    id: 'planet-clicker-unlocked',
    title: 'Planet Clicker Unlocked',
    image: 'https://mt.free-online-games.co/planet-clicker-game/planet-clicker-unlocked/planet-clicker-unlocked-bj.webp',
    url: '/sci-fi-clicker-games/planet-clicker-unlocked',
    plays: 850000,
    rating: 4.9,
  },
  {
    id: 'planet-clicker-pro',
    title: 'Planet Clicker Pro',
    image: 'https://mt.free-online-games.co/planet-clicker-game/planet-clicker-pro/planet-clicker-pro-bj.webp',
    url: '/sci-fi-clicker-games/planet-clicker-pro',
    plays: 1200000,
    rating: 5.0,

  },
  {
    id: 'planet-clicker-2019',
    title: 'Planet Clicker 2019',
    image: 'https://mt.free-online-games.co/planet-clicker-game/planet-clicker-2019/planet-clicker-2019-bj.webp',
    url: '/sci-fi-clicker-games/planet-clicker-2019',
    plays: 930000,
    rating: 4.7,
  },
  {
    id: 'planet-clicker-2022',
    title: 'Planet Clicker 2022',
    image: 'https://mt.free-online-games.co/planet-clicker-game/planet-clicker-2022/planet-clicker-2022-bj.webp',
    url: '/sci-fi-clicker-games/planet-clicker-2022',
    plays: 980000,
    rating: 4.9,
 
  },
];

interface RelatedGamesProps {
  games?: Game[];
}

export const RelatedGames = ({ games = defaultGames }: RelatedGamesProps) => {
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});
  const [loadedVideos, setLoadedVideos] = useState<Set<string>>(new Set());

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
    <div className="w-full xl:w-[150px]">
      <div className="grid grid-cols-3 gap-2 xl:grid-cols-1">
        {games?.slice(0, 6).map((game) => (
          <Link 
            key={game.id}
            href={game.url}
            className="group block"
            onMouseEnter={() => handleVideoMouseEnter(game.id)}
            onMouseLeave={() => handleVideoMouseLeave(game.id)}
          >
            <div className="relative aspect-[16/9] overflow-hidden rounded-lg shadow-md">
              <Image
                src={game.image}
                alt={game.title}
                fill
                className={`absolute inset-0 w-full h-full object-cover object-center ${game.videoUrl ? 'xl:group-hover:opacity-0' : ''} transition-opacity duration-300`}
                loading="lazy"
                sizes="(max-width: 768px) 100vw, (max-width: 1280px) 33vw, 150px"
                quality={60}
                placeholder="blur"
                blurDataURL="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 9'%3E%3Cfilter id='b' color-interpolation-filters='sRGB'%3E%3CfeGaussianBlur stdDeviation='1'/%3E%3C/filter%3E%3Crect width='16' height='9' x='0' y='0' fill='%23f3f4f6'/%3E%3C/svg%3E"
              />
              {game.videoUrl && (
                <video
                  ref={(el) => videoRefs.current[game.id] = el}
                  className="absolute inset-0 w-full h-full object-cover opacity-0 xl:group-hover:opacity-100 transition-opacity duration-300 hidden xl:block"
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