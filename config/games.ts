export interface Game {
  id: string;
  title: string;
  image: string;
  url: string;
  plays?: number;
  rating?: number;
  description?: string;
  createdAt?: string;
  videoUrl?: string;
  isHot?: boolean;
}

export interface GameCategory {
  id: string;
  title: string;
  path: string;
  description: string;
  games: Game[];
}

// 基于字符串种子生成随机数
export function seededRandom(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash = hash & hash;
  }
  return (Math.abs(hash) % 1000) / 1000;
}

// Helper function to generate deterministic date between 2023-06-01 and 2024-01-25
function getRandomDate(id: string) {
  const start = new Date('2023-06-01').getTime();
  const end = new Date('2024-01-25').getTime();
  const random = seededRandom(id + 'date');
  const timestamp = start + (random * (end - start));
  return new Date(timestamp).toISOString().split('T')[0];
}

// Helper function to generate deterministic rating between 4.1 and 5.0
function getRandomRating(id: string) {
  const random = seededRandom(id + 'rating');
  return (4.1 + random * 0.9).toFixed(1);
}

// Helper function to generate deterministic plays between 50000 and 500000
function getRandomPlays(id: string) {
  const random = seededRandom(id + 'plays');
  return Math.floor(50000 + random * 450000);
}

export const gameCategories: GameCategory[] = [
  {
    id: 'sci-fi-clicker-games',
    title: 'Sci-Fi Clicker Games',
    path: '/sci-fi-clicker-games',
    description: 'Discover our collection of addictive clicker games. From candy collecting to planet exploration, find your perfect idle adventure!',
    games: [
      {
        id: 'planet-clicker',
        title: 'Planet Clicker',
        description: 'Planet Clicker is an addictive idle game where you explore planets, upgrade your space fleet, and build your galactic empire. Click your way to success and become the ultimate space explorer!',
        image: '/planet-clicker-logo.webp',
        url: '/sci-fi-clicker-games/planet-clicker',
        plays: 920000,
        rating: 4.8,
        createdAt: '2024-01-20',
        videoUrl: '/planet-clicker-bj.webp',
        isHot: true
      },
        
      {
        id: 'planet-clicker-2',
        title: 'Planet Clicker 2',
        description: 'Experience the enhanced version of Planet Clicker with improved graphics, new features, and more engaging gameplay! Explore new galaxies, upgrade your space fleet, and become the ultimate cosmic explorer in this addictive idle game.',
        image: '/planet-clicker-2-logo.webp',
        url: '/sci-fi-clicker-games/planet-clicker-2',
        plays: 950000,
        rating: 4.9,
        createdAt: '2024-01-25',
        videoUrl: '/planet-clicker-2-bj.webp',
        isHot: true
      },
     
      {
        id: 'planet-clicker-unlocked',
        title: 'Planet Clicker Unlocked',
        description: 'Planet Clicker Unlocked is a modified version of the original Planet Clicker, allowing users to easily unlock in-game features by increasing score acquisition.',
        image: 'https://mt.free-online-games.co/planet-clicker-game/planet-clicker-unlocked/planet-clicker-unlocked-logo.webp',
        url: '/sci-fi-clicker-games/planet-clicker-unlocked',
        plays: 1200000,
        rating: Number(getRandomRating('planet-clicker-unlocked')),
        createdAt: getRandomDate('planet-clicker-unlocked'),
        videoUrl: 'https://mt.free-online-games.co/planet-clicker-game/planet-clicker-unlocked/planet-clicker-unlocked-bj.webp',
        isHot: false
      },
      {
        id: 'planet-clicker-pro',
        title: 'Planet Clicker Pro',
        description: 'Planet Clicker Pro is an expansion DLC of the original Planet Clicker, featuring additional planets beyond the original content.',
        image: 'https://mt.free-online-games.co/planet-clicker-game/planet-clicker-pro/planet-clicker-pro-logo.webp',
        url: '/sci-fi-clicker-games/planet-clicker-pro',
        plays:1680000,
        rating: Number(getRandomRating('planet-clicker-pro')),
        createdAt: getRandomDate('planet-clicker-pro'),
        videoUrl: 'https://mt.free-online-games.co/planet-clicker-game/planet-clicker-pro/planet-clicker-pro-bj.webp',
        isHot: false
      },
      {
        id: 'planet-clicker-2019',
        title: 'Planet Clicker 2019',
        description: 'Planet Clicker 2019 is a pioneering version that predates the original Planet Clicker by a year. With retro graphics and classic gameplay, it ranks as the third most popular game on Scratch and represents the true beginning of the Planet Clicker series.',
        image: 'https://mt.free-online-games.co/planet-clicker-game/planet-clicker-2019/planet-clicker-2019-logo.webp',
        url: '/sci-fi-clicker-games/planet-clicker-2019',
        plays: 930000,
        rating: 4.7,
        createdAt: '2019-06-15',
        videoUrl: 'https://mt.free-online-games.co/planet-clicker-game/planet-clicker-2019/planet-clicker-2019-bj.webp',
        isHot: true
      },
      {
        id: 'planet-clicker-2022',
        title: 'Planet Clicker 2022',
        description: 'Planet Clicker 2022 is the second most popular Planet Clicker game on Scratch. This unique version offers a distinctly different gameplay experience with innovative mechanics and a dynamic leaderboard system that enhances player engagement.',
        image: 'https://mt.free-online-games.co/planet-clicker-game/planet-clicker-2022/planet-clicker-2022-logo.webp',
        url: '/sci-fi-clicker-games/planet-clicker-2022',
        plays: 980000,
        rating: 4.9,
        createdAt: '2022-03-10',
        videoUrl: 'https://mt.free-online-games.co/planet-clicker-game/planet-clicker-2022/planet-clicker-2022-bj.webp',
        isHot: true
      },

    ]
  },
 
];