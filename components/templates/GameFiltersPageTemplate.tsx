import { GameFiltersExplorer } from "@/components/templates/GameFiltersExplorer";
import { getAllGameTagSummaries } from "@/config/game-tags";
import { getFilterPageGames } from "@/config/game-filters";
import { GAME_FILTERS_PAGE } from "@/config/game-filters-page";

export function GameFiltersPageTemplate() {
  return (
    <main className="flex-1 px-4 py-8">
      <div className="site-container-width mx-auto">
        <GameFiltersExplorer
          games={getFilterPageGames()}
          legacyTags={getAllGameTagSummaries()}
          page={GAME_FILTERS_PAGE}
        />
      </div>
    </main>
  );
}
