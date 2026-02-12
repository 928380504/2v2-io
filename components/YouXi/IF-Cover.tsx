// 这是if游戏框的区域中的：遮罩区域
import Image from 'next/image';

interface GameCoverProps {
  onStart: () => void;
}

export function GameCover({ onStart }: GameCoverProps) {
  return (
    <div className="absolute inset-0 overflow-hidden">
       {/* Logo - 放在最前面以便搜索引擎优先抓取，但不显示 */}
      <Image 
        src="/2v2-io-logo.webp"
        alt="2v2.io"
        width={64}
        height={64}
        className="hidden"
        priority
      />
      <Image
        src="/2v2-io-bj.webp"
        alt="2v2.io"
        fill
        sizes="100vw"
        quality={5}
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
                src="/2v2-io-logo.webp"
                alt="2v2.io Logo"
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
            2v2.io
          </h1>

          {/* Description */}
          <p className="text-sm text-white/80 drop-shadow">
           2v2.io is a fast-paced battle royale game that fuses sharp shooting with instant building, where you and your teammate fight to be the last squad standing in a shrinking arena.​
          </p>

          {/* Start Button */}
          <button 
            onClick={onStart}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-xl font-semibold text-sm
              hover:bg-green-500 transition-all duration-200 
              shadow-[0_4px_12px_rgba(0,0,0,0.1)] 
              hover:shadow-[0_8px_24px_rgba(47,133,90,0.3)]
              backdrop-blur-sm relative
              animate-pulse-subtle mx-auto cursor-pointer
              group"
            aria-label="Play Game"
          >
            <span className="w-4 h-4 bg-white rounded-full flex items-center justify-center text-green-600 text-xs
              group-hover:scale-110 transition-transform duration-200">
              ▶
            </span>
            <span className="relative z-10">Play Now</span>
            <div className="absolute inset-0 rounded-xl bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-200"></div>
          </button>
        </div>
      </div>
    </div>
  );
}