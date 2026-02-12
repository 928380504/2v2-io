// 这是首页游戏的资讯栏区域
"use client";

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faBook, 
  faTrophy, 
  faRunning, 
  faLockOpen,
  faGamepad 
} from '@fortawesome/free-solid-svg-icons';

interface GameButtonsProps {
  className?: string;
}

export function GameButtons({ className }: GameButtonsProps) {
  const handleClick = (url: string) => {
    window.open(url, '_blank');
  };

  return (
    <div className={`flex flex-wrap gap-2 sm:gap-4 mb-4 ${className}`}>
      <button 
        onClick={() => handleClick('/blog/text-twist-introduction')}
        className="px-2 py-1.5 sm:px-4 sm:py-2 bg-blue-400 dark:bg-green-900 text-white rounded hover:bg-blue-500 dark:hover:bg-green-950 transition flex items-center gap-1 sm:gap-2 text-shadow font-sans text-sm sm:text-base"
      >
        <FontAwesomeIcon icon={faBook} className="text-shadow w-3 h-3 sm:w-4 sm:h-4" />
        <span className="text-shadow">Game Introduction</span>
      </button>
      <button 
        onClick={() => handleClick('/word-games/text-twist-2-untimed')}
        className="px-2 py-1.5 sm:px-4 sm:py-2 bg-amber-600 dark:bg-green-900 text-white rounded hover:bg-amber-700 dark:hover:bg-green-950 transition flex items-center gap-1 sm:gap-2 text-shadow font-sans text-sm sm:text-base"
      >
        <FontAwesomeIcon icon={faGamepad} className="text-shadow w-3 h-3 sm:w-4 sm:h-4" />
        <span className="text-shadow">Text Twist 2 Untimed</span>
      </button>
      <button 
        onClick={() => handleClick('/blog/text-twist-speedrun-guide')}
        className="px-2 py-1.5 sm:px-4 sm:py-2 bg-purple-400 dark:bg-green-900 text-white rounded hover:bg-purple-500 dark:hover:bg-green-950 transition flex items-center gap-1 sm:gap-2 text-shadow font-sans text-sm sm:text-base"
      >
        <FontAwesomeIcon icon={faRunning} className="text-shadow w-3 h-3 sm:w-4 sm:h-4" />
        <span className="text-shadow">Speedrun Guide</span>
      </button>
      <button 
        onClick={() => handleClick('/game-fools/word-unscrambler')}
        className="px-2 py-1.5 sm:px-4 sm:py-2 bg-rose-400 dark:bg-green-900 text-white rounded hover:bg-rose-500 dark:hover:bg-green-950 transition flex items-center gap-1 sm:gap-2 text-shadow font-sans text-sm sm:text-base"
      >
        <FontAwesomeIcon icon={faLockOpen} className="text-shadow w-3 h-3 sm:w-4 sm:h-4" />
        <span className="text-shadow">Word Unscrambler</span>
      </button>
    </div>
  );
}