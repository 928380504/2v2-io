"use client";

import { cn } from '@/lib/utils';
import { useState, useCallback } from 'react';
import Image from 'next/image';

interface VideoPlayerProps {
  videoId: string;
  title?: string;
  description?: string;
  className?: string;
}

export function VideoPlayer({ 
  videoId, 
  title = "Gameplay Video", 
  description = "Watch how to play Candy Clicker and learn the best strategies to maximize your candy production!",
  className = "" 
}: VideoPlayerProps) {
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);

  const loadVideo = useCallback(() => {
    setIsVideoLoaded(true);
  }, []);

  // 使用较小的缩略图版本
  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

  return (
    <div className={cn("w-full", className)}>
      <div className="text-center mb-12">
        <span className="inline-block px-4 py-2 rounded-full bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 text-sm font-medium mb-4">
          Watch & Learn
        </span>
        <h2 className="text-3xl md:text-4xl font-bold text-green-800 dark:text-green-100 mb-4">
          {title}
        </h2>
        <div className="w-24 h-1 bg-green-500 mx-auto mb-8"></div>
        <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
          {description}
        </p>
      </div>
      
      <div className="relative bg-white/80 dark:bg-[#0d4021] backdrop-blur-sm rounded-tl-3xl overflow-hidden shadow-lg">
        <div className="relative" style={{ paddingBottom: '56.25%' }}>
          {!isVideoLoaded ? (
            <div 
              className="absolute inset-0 flex items-center justify-center cursor-pointer group"
              onClick={loadVideo}
            >
              <Image
                src={thumbnailUrl}
                alt={title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                quality={75}
                priority={false}
              />
              <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition-colors"></div>
              <div className="flex flex-col items-center gap-4 relative z-10">
                <div className="w-20 h-20 flex items-center justify-center rounded-full bg-red-600 group-hover:bg-red-700 group-hover:scale-110 transition-all">
                  <svg 
                    className="w-10 h-10 text-white" 
                    fill="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
                <span className="text-lg font-medium text-white">
                  Click to Play Video
                </span>
              </div>
            </div>
          ) : (
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
            />
          )}
        </div>
      </div>
    </div>
  );
}