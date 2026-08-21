import { Flame } from "lucide-react";
import { LiveGameCards } from "@/components/templates/LiveGameCards";
import { getHotGames, HOT_GAMES_PAGE } from "@/config/hot-games-page";

export function HotGamesPageTemplate() {
  const games = getHotGames();

  return (
    <main className="flex-1 px-4 py-8">
      <div className="site-container-width mx-auto">
        <header className="mb-8">
          <div className="mb-4 flex items-center gap-3">
            <Flame className="h-8 w-8 text-orange-500" aria-hidden="true" />
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
              {HOT_GAMES_PAGE.heading}
            </h1>
          </div>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            {HOT_GAMES_PAGE.description}
          </p>
        </header>

        <LiveGameCards
          games={games}
          ranked
          orderByPopularity
          limit={HOT_GAMES_PAGE.limit}
        />
      </div>
    </main>
  );
}
