import { Mouse, Target, Trophy } from 'lucide-react';

export function Title() {
  return (
    <section>
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-2 rounded-full bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 text-sm font-medium mb-4">
            Play Now
          </span>
          <h2 className="text-4xl md:text-6xl font-bold text-green-800 dark:text-green-100 mb-4">
            Play 2v2.io Online for Free
          </h2>
          <p className="text-gray-600 dark:text-gray-300 text-lg md:text-xl max-w-2xl mx-auto mb-16">
            Team up in pairs, loot fast, build instantly, and outplay squads in a tactical 2v2 battle royale shooter.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="flex flex-col items-center p-6 rounded-2xl bg-white dark:bg-green-800/30 shadow-sm hover:shadow-md hover:translate-y-[-4px] transition-all duration-300">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-800 flex items-center justify-center mb-4">
                <Mouse className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-green-800 dark:text-green-100 mb-2">
                Fast Squad Combat
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Drop in with your teammate, grab weapons, and win fights with smart positioning and aim.
              </p>
            </div>

            <div className="flex flex-col items-center p-6 rounded-2xl bg-white dark:bg-green-800/30 shadow-sm hover:shadow-md hover:translate-y-[-4px] transition-all duration-300">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-800 flex items-center justify-center mb-4">
                <Target className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-green-800 dark:text-green-100 mb-2">
                Instant Building
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Build walls, ramps, and roofs mid-fight to take cover, gain height, and create angles.
              </p>
            </div>

            <div className="flex flex-col items-center p-6 rounded-2xl bg-white dark:bg-green-800/30 shadow-sm hover:shadow-md hover:translate-y-[-4px] transition-all duration-300">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-800 flex items-center justify-center mb-4">
                <Trophy className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-green-800 dark:text-green-100 mb-2">
                Team Strategy
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Coordinate pushes, share resources, and stay ahead of the shrinking zone to be last squad standing.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
