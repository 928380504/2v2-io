import React from 'react';
import { Clock, Book, Target, Brain } from 'lucide-react';

interface FeatureItemProps {
  icon: React.ReactNode;
  text: string;
}

const FeatureItem = ({ icon, text }: FeatureItemProps) => (
  <div className="flex flex-col items-center text-center p-4 bg-white/80 dark:bg-green-800/30 backdrop-blur-sm rounded-2xl shadow-sm hover:shadow-2xl hover:translate-y-[-4px] transition-all duration-300 group">
    <div className="mb-3">
      <div className="w-14 h-14 bg-gradient-to-br from-green-100 to-green-200 dark:from-green-800 dark:to-green-700 rounded-xl flex items-center justify-center transform rotate-12 group-hover:rotate-0 transition-transform duration-300">
        <div className="w-12 h-12 bg-white dark:bg-green-900 rounded-lg flex items-center justify-center transform -rotate-12 group-hover:rotate-0 transition-transform duration-300">
          {React.cloneElement(icon as React.ReactElement, { className: "w-7 h-7 text-green-600 dark:text-green-400" })}
        </div>
      </div>
    </div>
    <h3 className="text-base font-semibold text-green-800 dark:text-green-100 mb-1 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors duration-300">
      {text.split(':')[0]}
    </h3>
    {text.split(':')[1] && (
      <p className="text-xs text-gray-600 dark:text-gray-300 group-hover:text-gray-800 dark:group-hover:text-gray-200 transition-colors duration-300">
        {text.split(':')[1]}
      </p>
    )}
  </div>
);

export function GameIntro() {
  const features = [
    {
      icon: <Clock />,
      text: "Quick Matches:Jump in fast and finish games in minutes"
    },
    {
      icon: <Book />,
      text: "Tactical Depth:Smart looting, positioning, and zone control win games"
    },
    {
      icon: <Target />,
      text: "Instant Builds:Create walls, ramps, and roofs during fights for advantage"
    },
    {
      icon: <Brain />,
      text: "Team Focus:Two-player squads reward coordination and communication"
    }
  ];

  return (
    <section id="intro">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <span className="inline-block px-4 py-2 rounded-full bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 text-sm font-medium mb-4">
            About The Game
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-green-800 dark:text-green-100 mb-4">
            Welcome to 2v2.io
          </h2>
          <div className="w-24 h-1 bg-green-500 mx-auto mb-8"></div>
        </div>

        <div className="max-w-6xl mx-auto space-y-8">
          <div className="bg-white/80 dark:bg-green-800/30 backdrop-blur-sm rounded-2xl p-8 shadow-sm hover:shadow-2xl hover:translate-y-[-4px] transition-all duration-300">
            <div className="prose prose-lg dark:prose-invert max-w-none">
              <p className="text-gray-700 dark:text-gray-200 leading-relaxed">
                2v2.io is a fast-paced multiplayer battle royale shooter where you team up with a partner and fight other squads. Land, loot, and take smart fights while the zone closes in.
              </p>
              
              <p className="text-gray-700 dark:text-gray-200 leading-relaxed">
                You can quickly place walls, ramps, and roofs during combat to block shots, gain height, and create tactical angles.
              </p>
              
              <p className="text-gray-700 dark:text-gray-200 leading-relaxed">
                With quick matches, simple controls, and deep team strategy, 2v2.io is easy to start and rewarding to master. Coordinate with your teammate and aim for the last squad standing.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {features.map((feature, index) => (
              <FeatureItem
                key={index}
                icon={feature.icon}
                text={feature.text}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
