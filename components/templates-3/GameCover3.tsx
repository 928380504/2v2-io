"use client";

import Image from 'next/image';

interface GameCoverProps {
  onStart: () => void;
  gameTitle?: string;
  gameDescription?: string;
  gameImage?: string;
  gameBgImage?: string;
}

export function GameCover({ 
  onStart,
  gameTitle = "Stimulation Clicker",
  gameDescription = "Click your way to success in this addictive clicker game! Unlock powerful upgrades and watch your numbers grow exponentially.",
  gameImage = "https://mt.stimulation-clicker.org/game-img/incremental-clicker-games/stimulation-clicker/stimulation-clicker-logo.webp",
  gameBgImage = "https://mt.stimulation-clicker.org/game-img/incremental-clicker-games/stimulation-clicker/stimulation-clicker-bj.webp"
}: GameCoverProps) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <Image
        src={gameBgImage}
        alt={gameTitle}
        fill
        sizes="100vw"
        quality={75}
        priority
        loading="eager"
        className="object-cover object-center blur-sm"
      />
      
      {/* 灰色渐变遮罩 */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-800/60 to-gray-900/60 flex items-center justify-center">
        <div className="text-center space-y-4 max-w-lg px-4 backdrop-blur-sm bg-gray-900/20 rounded-2xl p-6
          hover:shadow-[0_0_30px_rgba(255,255,255,0.3)] transition-shadow duration-300">
          {/* Logo */}
          <div className="mb-2">
            <div className="w-20 h-20 mx-auto rounded-2xl flex items-center justify-center">
              <Image 
                src={gameImage}
                alt={`${gameTitle} Logo`}
                width={64}
                height={64}
                className="rounded-xl object-cover drop-shadow-2xl 
                  filter brightness-110 hover:brightness-125 transition-all duration-300
                  hover:scale-105 transform
                  ring-4 ring-white ring-offset-0"
              />
            </div>
          </div>

          {/* Title */}
          <h1 
            className="text-2xl md:text-3xl font-bold text-white drop-shadow-lg"
          >
            {gameTitle}
          </h1>

          {/* Description */}
          <p className="text-sm text-white/80 drop-shadow">
            {gameDescription}
          </p>

          {/* Start Button */}
          <button 
            onClick={onStart}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-xl font-semibold text-sm
              hover:bg-green-500 transition-all duration-200 
              shadow-[0_4px_12px_rgba(0,0,0,0.1)] 
              hover:shadow-[0_8px_24px_rgba(47,133,90,0.3)]
              backdrop-blur-sm relative
              animate-pulse-subtle mx-auto cursor-pointer"
          >
            <span className="w-4 h-4 bg-white rounded-full flex items-center justify-center text-green-600 text-xs
              group-hover:scale-110 transition-transform duration-200">
              ▶
            </span>
            Play now
            <div className="absolute inset-0 rounded-xl bg-white opacity-0 hover:opacity-10 transition-opacity duration-200"></div>
          </button>
        </div>
      </div>
    </div>
  );
}