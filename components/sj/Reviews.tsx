"use client";

import { cn } from '@/lib/utils';
import Image from 'next/image';

interface Review {
  username: string;
  avatarUrl: string;
  content: string;
  date: string;
  rating: number;
}

interface ReviewsProps {
  className?: string;
}

export function Reviews({ className = "" }: ReviewsProps) {
  const reviews: Review[] = [
    {
      username: "BattleMaster",
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=SpaceExplorer123",
      content: "2v2.io is incredibly fun and addictive. Instant building makes every fight feel tactical and intense.",
      date: "2 hours ago",
      rating: 5
    },
    {
      username: "BuilderPro",
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=GalaxyLover456",
      content: "Perfect for battle royale fans. In 2v2.io, walls and ramps mid-fight create so many smart plays with your teammate.",
      date: "1 day ago",
      rating: 5
    },
    {
      username: "SquadLeader",
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=PlanetFan789",
      content: "Great duo experience. Quick matches in 2v2.io, strong teamwork moments, and clutch end zones feel amazing.",
      date: "3 days ago",
      rating: 5
    },
    {
      username: "HighGround",
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=StarSeeker",
      content: "Building for height is the best part in 2v2.io. Ramps let you take control fast and turn bad fights around.",
      date: "1 week ago",
      rating: 5
    },
    {
      username: "ZoneRunner",
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=CosmicMaster",
      content: "The shrinking zone keeps matches moving. Rotations matter and teamwork wins fights consistently.",
      date: "2 weeks ago",
      rating: 5
    },
    {
      username: "QuickLoot",
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=SpaceCommander",
      content: "Easy to start and hard to master. Looting is fast, fights are constant, and builds add real depth.",
      date: "1 month ago",
      rating: 5
    }
  ];

  return (
    <div className={cn("w-full", className)}>
      <div className="text-center mb-12">
        <span className="inline-block px-4 py-2 rounded-full bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 text-sm font-medium mb-4">
          Player Reviews
        </span>
        <h2 className="text-3xl md:text-4xl font-bold text-green-800 dark:text-green-100 mb-4">
          What Players Say
        </h2>
        <div className="w-24 h-1 bg-green-500 mx-auto mb-8"></div>
        <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-12">
          Join thousands of players who love 2v2.io. Here is what they have to say about their experience.
        </p>
      </div>

      <div className="relative max-w-7xl mx-auto px-4">
        <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 to-transparent dark:from-green-500/10 rounded-3xl"></div>
        <div className="relative grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reviews.map((review, index) => (
            <div 
              key={index}
              className={cn(
                "group relative bg-white/80 dark:bg-[#0d4021] backdrop-blur-sm rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 transform",
                index === 0 && "hover:-rotate-1 hover:-translate-y-1",
                index === 1 && "md:translate-y-8 hover:rotate-1 hover:-translate-y-1",
                index === 2 && "lg:translate-y-4 hover:-rotate-2 hover:-translate-y-1",
                index === 3 && "md:translate-y-4 hover:rotate-2 hover:-translate-y-1",
                index === 4 && "lg:translate-y-8 hover:-rotate-1 hover:-translate-y-1",
                index === 5 && "hover:rotate-1 hover:-translate-y-1"
              )}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-green-400/10 dark:from-green-500/5 dark:to-green-400/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative flex flex-col h-full">
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative w-12 h-12 flex-shrink-0">
                    <div className="absolute inset-0 bg-gradient-to-br from-green-500/20 to-green-400/20 dark:from-green-500/10 dark:to-green-400/10 blur-xl rounded-full"></div>
                    <div className="relative w-full h-full rounded-full overflow-hidden border-2 border-green-500/20 group-hover:border-green-500/40 transition-colors duration-300">
                      <Image
                        src={review.avatarUrl}
                        alt={`${review.username}'s avatar`}
                        fill
                        className="object-cover transform group-hover:scale-110 transition-transform duration-300"
                      />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-green-800 dark:text-green-100 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors duration-300">
                      {review.username}
                    </h3>
                    <div className="flex items-center gap-1 mt-1">
                      {[...Array(5)].map((_, i) => (
                        <svg
                          key={i}
                          className={`w-4 h-4 ${
                            i < review.rating
                              ? "text-yellow-400 group-hover:text-yellow-500"
                              : "text-gray-300 dark:text-gray-600"
                          } transition-colors duration-300`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-gray-600 dark:text-gray-300 mb-4 group-hover:text-gray-800 dark:group-hover:text-gray-200 transition-colors duration-300 flex-grow">
                  {review.content}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors duration-300 mt-auto">
                  {review.date}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
