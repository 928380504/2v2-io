import { MousePointer, TrendingUp, Rocket, Target, Zap, ChevronRight, LucideIcon } from 'lucide-react';

interface Feature {
  title: string;
  description: string;
  icon: LucideIcon;
  color?: string;
}

interface Section {
  title: string;
  description: string;
  features: Feature[];
}

export function HowToPlay() {
  const sections: Section[] = [
    {
      title: 'Drop In & Loot',
      description: 'Start strong in 2v2.io by landing smart and gearing up quickly',
      features: [
        {
          title: 'Choose a Landing Spot',
          description: 'Land with your teammate and pick safe loot routes',
          icon: MousePointer,
        },
        {
          title: 'Collect Gear Fast',
          description: 'Grab weapons, ammo, and materials to prepare for fights',
          icon: Zap,
        },
      ],
    },
    {
      title: 'Build & Fight',
      description: 'Use instant building in 2v2.io to control angles and survive pushes',
      features: [
        {
          title: 'Walls for Cover',
          description: 'Build a wall to block shots and reset the fight',
          icon: TrendingUp,
        },
        {
          title: 'Ramps for Height',
          description: 'Use ramps to take high ground and peek safely',
          icon: Zap,
        },
        {
          title: 'Roofs for Protection',
          description: 'Place roofs to stop shots from above and hold space',
          icon: TrendingUp,
        },
      ],
    },
    {
      title: 'Team Play & Positioning',
      description: 'Win more fights in 2v2.io with coordination and smart rotations',
      features: [
        {
          title: 'Stick Together',
          description: 'Trade shots and focus targets with your teammate',
          icon: MousePointer,
          color: 'bg-blue-100 dark:bg-blue-900/30',
        },
        {
          title: 'Play the Zone',
          description: 'Rotate early and take good positions before fights start',
          icon: Rocket,
          color: 'bg-red-100 dark:bg-red-900/30',
        },
        {
          title: 'Build Under Pressure',
          description: 'Use quick builds to create cover and escape bad angles',
          icon: Target,
          color: 'bg-yellow-100 dark:bg-yellow-900/30',
        },
      ],
    },
    {
      title: 'Win the Match',
      description: 'Outlast every squad in 2v2.io and secure the final elimination',
      features: [
        {
          title: 'Choose Smart Fights',
          description: 'Pick favorable engagements and avoid bad trades',
          icon: TrendingUp,
        },
        {
          title: 'Control High Ground',
          description: 'Use ramps and builds to keep the advantage',
          icon: Rocket,
        },
        {
          title: 'Last Squad Standing',
          description: 'Survive the final zone in 2v2.io and finish strong as a duo',
          icon: Target,
        },
      ],
    },
  ];

  return (
    <section id="guide" className="bg-green-50 dark:bg-green-900/30 py-16">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <span className="inline-block px-4 py-2 rounded-full bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 text-sm font-medium mb-4">
            Game Guide
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-green-800 dark:text-green-100 mb-4">
            How to Play 2v2.io
          </h2>
          <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Learn the basics of looting, instant building, and duo strategy to win matches.
          </p>
        </div>

        <div className="max-w-6xl mx-auto space-y-12">
          {sections.map((section, sectionIndex) => (
            <div key={sectionIndex} className="bg-white dark:bg-green-800/30 rounded-2xl p-8 shadow-lg">
              <div className="mb-8">
                <h3 className="text-2xl font-bold text-green-800 dark:text-green-100 mb-2">
                  {section.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  {section.description}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {section.features.map((feature: Feature, index: number) => (
                  <div
                    key={index}
                    className={`p-6 rounded-xl ${
                      feature.color || 'bg-green-50 dark:bg-green-900/20'
                    } hover:shadow-md transition-all duration-300`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-white dark:bg-green-800 flex items-center justify-center flex-shrink-0">
                        <feature.icon className="w-6 h-6 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold text-green-800 dark:text-green-100 mb-2">
                          {feature.title}
                        </h4>
                        <p className="text-gray-600 dark:text-gray-300">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {sectionIndex === 2 && (
                <div className="mt-8 p-6 bg-green-50 dark:bg-green-900/20 rounded-xl">
                  <h4 className="text-lg font-semibold text-green-800 dark:text-green-100 mb-4">
                    Default Building Controls
                  </h4>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                        <span className="text-blue-600 dark:text-blue-400">1</span>
                      </div>
                      <div>
                        <p className="text-gray-600 dark:text-gray-300">
                          Z: Build walls for cover and protection
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                        <span className="text-red-600 dark:text-red-400">2</span>
                      </div>
                      <div>
                        <p className="text-gray-600 dark:text-gray-300">
                          X: Build ramps for high ground advantage
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center">
                        <span className="text-yellow-600 dark:text-yellow-400">3</span>
                      </div>
                      <div>
                        <p className="text-gray-600 dark:text-gray-300">
                          C: Build roofs for overhead protection
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                        <span className="text-green-600 dark:text-green-400">4</span>
                      </div>
                      <div>
                        <p className="text-gray-600 dark:text-gray-300">
                          G: Edit and modify your builds
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                        <span className="text-purple-600 dark:text-purple-400">5</span>
                      </div>
                      <div>
                        <p className="text-gray-600 dark:text-gray-300">
                          Right mouse button: Switch between aim and build mode
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
