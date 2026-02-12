import { useState } from 'react';
import Image from 'next/image';

interface VideoFacadeProps {
  videoId: string;
  title: string;
}

export function VideoFacade({ videoId, title }: VideoFacadeProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const thumbnailUrl = `https://i.ytimg.com/vi_webp/${videoId}/maxresdefault.webp`;

  if (isPlaying) {
    return (
      <div className="aspect-video w-full">
        <iframe
          width="100%"
          height="100%"
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="rounded-lg"
        />
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsPlaying(true)}
      className="group relative aspect-video w-full overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800"
      aria-label={`Play ${title}`}
    >
      <Image
        src={thumbnailUrl}
        alt="Video thumbnail"
        fill
        className="object-cover transition-transform duration-300 group-hover:scale-105"
        sizes="(max-width: 1200px) 100vw, 1200px"
      />
      {/* Play button overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/40">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-white transition-transform group-hover:scale-110">
          <svg
            className="h-8 w-8"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>
      {/* Title overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
        <p className="text-lg font-semibold text-white">{title}</p>
      </div>
    </button>
  );
}