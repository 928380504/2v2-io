import { Gamepad2 } from "lucide-react";
import { LiveGameCards } from "@/components/templates/LiveGameCards";
import {
  getCategoryPageGames,
  type CategoryPageDefinition,
} from "@/config/category-pages";

interface CategoryPageTemplateProps {
  page: CategoryPageDefinition;
}

export function CategoryPageTemplate({ page }: CategoryPageTemplateProps) {
  const games = getCategoryPageGames(page);

  return (
    <main className="flex-1 px-4 py-8">
      <div className="site-container-width mx-auto">
        <header className="mb-8">
          <div className="mb-4 flex items-center gap-3">
            <Gamepad2 className="h-8 w-8 text-green-500" aria-hidden="true" />
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
              {page.heading}
            </h1>
          </div>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            {page.description}
          </p>
        </header>

        <LiveGameCards games={games} orderByPopularity />
      </div>
    </main>
  );
}
