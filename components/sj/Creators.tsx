"use client";

import { cn } from '@/lib/utils';
import Link from 'next/link';
import Image from 'next/image';

interface CreatorInfo {
  name: string;
  profileUrl: string;
  releaseDate: string;
  projectUrl: string;
  avatarUrl: string;
}

interface CreatorsProps {
  className?: string;
}

export function Creators({ className = "" }: CreatorsProps) {
  const creators: CreatorInfo[] = [
    
    {
      name: "Coltroc",
      profileUrl: "https://scratch.mit.edu/users/Coltroc/",
      releaseDate: "2020/05/29",
      projectUrl: "https://scratch.mit.edu/projects/377874630/",
      avatarUrl: "https://cdn2.scratch.mit.edu/get_image/user/50621649_48x48.png"
    },
    {
      name: "Coltroc",
      profileUrl: "https://scratch.mit.edu/users/Coltroc/",
      releaseDate: "2022/06/20",
      projectUrl: "https://scratch.mit.edu/projects/420580794/",
      avatarUrl: "https://cdn2.scratch.mit.edu/get_image/user/50621649_48x48.png"
    }
  ];

  return (
    <div className={cn("w-full", className)}>
      <div className="text-center mb-12">
        <span className="inline-block px-4 py-2 rounded-full bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 text-sm font-medium mb-4">
          Game Creators
        </span>
        <h2 className="text-3xl md:text-4xl font-bold text-green-800 dark:text-green-100 mb-4">
          Meet the Creators
        </h2>
        <div className="w-24 h-1 bg-green-500 mx-auto mb-8"></div>
        <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-12">
        Planet Clicker's success is largely attributed to the innovative work of Coltroc, whose Planet Clicker 2 brought the game to new heights.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {creators.map((creator, index) => (
          <div 
            key={index}
            className="bg-white/80 dark:bg-[#0d4021] backdrop-blur-sm rounded-tl-3xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-300"
          >
            <div className="flex flex-col items-center text-center">
              <div className="relative w-24 h-24 mb-4">
                <div className="absolute inset-0 bg-green-500/10 dark:bg-green-400/10 blur-xl rounded-full"></div>
                <div className="relative w-full h-full rounded-full overflow-hidden border-2 border-green-500/20">
                  <Image
                    src={creator.avatarUrl}
                    alt={`${creator.name}'s avatar`}
                    fill
                    className="object-cover"
                  />
                </div>
              </div>
              <Link 
                href={creator.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-lg font-medium text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 mb-2"
              >
                {creator.name}
              </Link>
              <div className="w-16 h-1 bg-green-500 mx-auto mb-4"></div>
              <h3 className="text-xl font-semibold text-green-800 dark:text-green-100 mb-2">
                {index === 0 ? "Planet Clicker" : "Planet Clicker 2"}
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Released: {creator.releaseDate}
              </p>
              <Link 
                href={creator.projectUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 rounded-full bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-800/50 transition-colors duration-300"
              >
                View on Scratch
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 
