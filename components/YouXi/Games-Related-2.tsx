// 这是首页游戏区中，右侧的相关游戏组件
import Image from 'next/image';
import Link from 'next/link';
import { Game } from "@/config/games";
import { cn } from "@/lib/utils";

export const defaultGames: Game[] = [
  {
    id: 'planet-clicker',
    title: 'Planet Clicker',
    description: 'Planet Clicker is an addictive idle game where you explore planets, upgrade your space fleet, and build your galactic empire. Click your way to success and become the ultimate space explorer!',
    image: '/planet-clicker-bj.webp',
    url: '/sci-fi-clicker-games/planet-clicker',
    plays: 920000,
    rating: 4.8,
  },
  {
    id: 'planet-clicker-2',
    title: 'Planet Clicker 2',
    description: 'Experience the enhanced version of Planet Clicker with improved graphics, new features, and more engaging gameplay! Explore new galaxies, upgrade your space fleet, and become the ultimate cosmic explorer in this addictive idle game.',
    image: '/planet-clicker-2-bj.webp',
    url: '/sci-fi-clicker-games/planet-clicker-2',
    plays: 950000,
    rating: 4.9,
 
  },

  {
    id: 'planet-clicker-unlocked',
    title: 'Planet Clicker Unlocked',
    description: 'Planet Clicker Unlocked is a modified version of the original Planet Clicker, allowing users to easily unlock in-game features by increasing score acquisition.',
    image: 'https://mt.free-online-games.co/planet-clicker-game/planet-clicker-unlocked/planet-clicker-unlocked-bj.webp',
    url: '/sci-fi-clicker-games/planet-clicker-unlocked',
    plays: 850000,
    rating: 4.9,
  },
  {
    id: 'planet-clicker-pro',
    title: 'Planet Clicker Pro',
    description: 'Planet Clicker Pro is an expansion DLC of the original Planet Clicker, featuring additional planets beyond the original content.',
    image: 'https://mt.free-online-games.co/planet-clicker-game/planet-clicker-pro/planet-clicker-pro-bj.webp',
    url: '/sci-fi-clicker-games/planet-clicker-pro',
    plays: 1200000,
    rating: 5.0,

  },
  {
    id: 'planet-clicker-2019',
    title: 'Planet Clicker 2019',
    description: 'Planet Clicker 2019 is a pioneering version that predates the original Planet Clicker by a year. With retro graphics and classic gameplay, it ranks as the third most popular game on Scratch and represents the true beginning of the Planet Clicker series.',
    image: 'https://mt.free-online-games.co/planet-clicker-game/planet-clicker-2019/planet-clicker-2019-bj.webp',
    url: '/sci-fi-clicker-games/planet-clicker-2019',
    plays: 930000,
    rating: 4.7,
  },
  {
    id: 'planet-clicker-2022',
    title: 'Planet Clicker 2022',
    description: 'Planet Clicker 2022 is the second most popular Planet Clicker game on Scratch. This unique version offers a distinctly different gameplay experience with innovative mechanics and a dynamic leaderboard system that enhances player engagement.',
    image: 'https://mt.free-online-games.co/planet-clicker-game/planet-clicker-2022/planet-clicker-2022-bj.webp',
    url: '/sci-fi-clicker-games/planet-clicker-2022',
    plays: 980000,
    rating: 4.9,
 
  },
];

interface RelatedGamesProps {
  games?: Game[];
  className?: string;
}

// 修改导出的组件名称
export const RelatedGames2 = ({ games = defaultGames, className }: RelatedGamesProps) => {
  return (
    <div className={`w-full ${className || ''}`}>
      <div className="grid grid-cols-6 gap-4">
        {games?.slice(0, 6).map((game) => (
          <Link 
            key={game.id}
            href={game.url}
            className="group block transform transition-transform duration-300 hover:scale-105"
          >
            <div className="relative aspect-[16/9] overflow-hidden rounded-lg shadow-md group-hover:shadow-xl transition-shadow duration-300">
              <Image
                src={game.image}
                alt={game.title}
                fill
                className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-110"
                loading="lazy"
                sizes="(max-width: 768px) 100vw, (max-width: 1280px) 33vw, 150px"
                quality={60}
                placeholder="blur"
                blurDataURL="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 9'%3E%3Cfilter id='b' color-interpolation-filters='sRGB'%3E%3CfeGaussianBlur stdDeviation='1'/%3E%3C/filter%3E%3Crect width='16' height='9' x='0' y='0' fill='%23f3f4f6'/%3E%3C/svg%3E"
              />
              <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/90 via-black/70 to-transparent opacity-90 group-hover:opacity-100 transition-all duration-300">
                <div className="absolute bottom-2 left-2 right-2 transform transition-transform duration-300 group-hover:translate-y-[-4px]">
                  <h3 className="text-white text-sm font-medium line-clamp-2 group-hover:text-yellow-300 transition-colors duration-300">
                    {game.title}
                  </h3>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};