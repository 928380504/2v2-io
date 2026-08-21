"use client";

import { useEffect, useMemo, useState } from "react";
import {
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { Game } from "@/config/game-catalog";
import { getGameTagSlug, type GameTagSummary } from "@/config/game-tags";
import {
  gameFilterGroups,
  getGameFilterAttributes,
  getGameFilterOption,
} from "@/config/game-filters";
import type { GameFiltersPageDefinition } from "@/config/game-filters-page";
import { LiveGameCards } from "@/components/templates/LiveGameCards";
import { GameFilterGroupIcon } from "@/components/templates/GameFilterGroupIcon";

interface GameFiltersExplorerProps {
  games: Game[];
  legacyTags: GameTagSummary[];
  page: GameFiltersPageDefinition;
}

type SelectedFilters = Partial<Record<string, string>>;

interface ParsedFilters {
  selected: SelectedFilters;
  legacySlugs: string[];
}

function parseTagQuery(value: string | null): ParsedFilters {
  const selected: SelectedFilters = {};
  const legacySlugs: string[] = [];

  (value || "")
    .split(",")
    .map((slug) => slug.trim().toLowerCase())
    .filter(Boolean)
    .forEach((slug) => {
      const match = getGameFilterOption(slug);
      if (match) {
        selected[match.group.key] = match.option.slug;
      } else if (!legacySlugs.includes(slug)) {
        legacySlugs.push(slug);
      }
    });

  return { selected, legacySlugs };
}

function serializeFilters(selected: SelectedFilters, legacySlugs: string[]) {
  return [
    ...gameFilterGroups
      .map((group) => selected[group.key])
      .filter((slug): slug is string => Boolean(slug)),
    ...legacySlugs,
  ];
}

export function GameFiltersExplorer({
  games,
  legacyTags,
  page,
}: GameFiltersExplorerProps) {
  const [filters, setFilters] = useState<ParsedFilters>({
    selected: {},
    legacySlugs: [],
  });

  useEffect(() => {
    const syncFiltersFromUrl = () => {
      const tagQuery = new URLSearchParams(window.location.search).get("tag");
      setFilters(parseTagQuery(tagQuery));
    };

    syncFiltersFromUrl();
    window.addEventListener("popstate", syncFiltersFromUrl);
    return () => window.removeEventListener("popstate", syncFiltersFromUrl);
  }, []);

  const legacyTagsBySlug = useMemo(
    () => new Map(legacyTags.map((tag) => [tag.slug, tag])),
    [legacyTags],
  );

  const matchesFilters = (
    game: Game,
    selected: SelectedFilters,
    legacySlugs: string[],
  ) => {
    const attributes = getGameFilterAttributes(game);
    const matchesStructuredFilters = gameFilterGroups.every((group) => {
      const selectedSlug = selected[group.key];
      return !selectedSlug || attributes[group.key].includes(selectedSlug);
    });
    if (!matchesStructuredFilters) return false;

    const gameLegacySlugs = new Set(
      (game.tags || []).map((tag) => getGameTagSlug(tag)),
    );
    return legacySlugs.every((slug) => gameLegacySlugs.has(slug));
  };

  const visibleGames = useMemo(
    () =>
      games.filter((game) =>
        matchesFilters(game, filters.selected, filters.legacySlugs),
      ),
    [filters, games],
  );

  const activeOptions = gameFilterGroups.flatMap((group) => {
    const selectedSlug = filters.selected[group.key];
    const option = group.options.find((item) => item.slug === selectedSlug);
    return option ? [option] : [];
  });
  const activeLegacyTags = filters.legacySlugs
    .map((slug) => legacyTagsBySlug.get(slug))
    .filter((tag): tag is GameTagSummary => Boolean(tag));
  const hasActiveFilters =
    activeOptions.length > 0 || filters.legacySlugs.length > 0;
  const heading =
    activeOptions.length === 1 && activeLegacyTags.length === 0
      ? `${activeOptions[0].label} ${page.filteredHeadingSuffix}`
      : activeOptions.length === 0 && activeLegacyTags.length === 1
        ? `${activeLegacyTags[0].name} ${page.filteredHeadingSuffix}`
        : page.heading;
  const description =
    activeOptions.length === 1 && activeLegacyTags.length === 0
      ? activeOptions[0].description
      : hasActiveFilters
        ? `Showing ${visibleGames.length} ${page.resultNoun}${visibleGames.length === 1 ? "" : "s"} matching ${[
            ...activeOptions.map((option) => option.label),
            ...activeLegacyTags.map((tag) => tag.name),
          ].join(", ")}.`
        : page.description;

  useEffect(() => {
    document.title = `${heading} - Play Free Online | ${page.siteName}`;
    const metaDescription = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    );
    if (metaDescription) metaDescription.content = description;
  }, [description, heading]);

  const updateLocation = (nextFilters: ParsedFilters) => {
    const slugs = serializeFilters(
      nextFilters.selected,
      nextFilters.legacySlugs,
    );
    const query = slugs.length
      ? `?tag=${slugs.map(encodeURIComponent).join(",")}`
      : "";
    window.history.pushState({}, "", `${page.path}${query}`);
    setFilters(nextFilters);
  };

  const selectOption = (
    groupKey: string,
    slug?: string,
  ) => {
    const selected = { ...filters.selected };
    if (slug) selected[groupKey] = slug;
    else delete selected[groupKey];

    updateLocation({ selected, legacySlugs: [] });
  };

  const clearAllFilters = () => {
    updateLocation({ selected: {}, legacySlugs: [] });
  };

  const getOptionCount = (
    groupKey: string,
    slug?: string,
  ) => {
    const selected = { ...filters.selected };
    if (slug) selected[groupKey] = slug;
    else delete selected[groupKey];

    return games.filter((game) =>
      matchesFilters(game, selected, filters.legacySlugs),
    ).length;
  };

  return (
    <>
      <header className="mb-7">
        <div className="mb-3 flex items-center gap-3">
          <SlidersHorizontal className="h-7 w-7 text-green-600 dark:text-green-400" />
          <h1 className="text-3xl font-black tracking-tight text-gray-950 dark:text-white sm:text-4xl">
            {heading}
          </h1>
        </div>
        <p className="max-w-4xl text-sm leading-7 text-gray-600 dark:text-gray-300 sm:text-base">
          {description}
        </p>
      </header>

      <section
        aria-label="Game attributes"
        className="mb-8 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-green-100 dark:bg-[#0d4021] dark:ring-green-700/40"
      >
        <div className="flex items-center justify-between border-b border-green-100 px-4 py-3 dark:border-green-700/40 sm:px-5">
          <div>
            <h2 className="text-sm font-black text-gray-900 dark:text-white">
              {page.attributesTitle}
            </h2>
            <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-300">
              {page.attributesDescription}
            </p>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-bold text-green-700 transition hover:bg-green-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 dark:text-green-300 dark:hover:bg-green-900/60"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              {page.clearAllLabel}
            </button>
          )}
        </div>

        <div className="divide-y divide-green-100 dark:divide-green-700/35">
          {gameFilterGroups.map((group) => {
            const activeSlug = filters.selected[group.key];

            return (
              <div
                key={group.key}
                className="grid gap-2 px-4 py-3.5 sm:grid-cols-[110px_minmax(0,1fr)] sm:items-start sm:gap-4 sm:px-5"
              >
                <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-gray-500 dark:text-gray-300">
                  <GameFilterGroupIcon icon={group.icon} />
                  {group.label}
                </h3>
                <div className="flex min-w-0 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => selectOption(group.key)}
                    aria-pressed={!activeSlug}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ring-1 ring-inset transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 ${
                      !activeSlug
                        ? "bg-green-700 text-white ring-green-700 dark:bg-green-400 dark:text-green-950 dark:ring-green-400"
                        : "bg-gray-50 text-gray-700 ring-gray-200 hover:bg-green-50 hover:text-green-700 dark:bg-green-950/40 dark:text-gray-200 dark:ring-green-700/45 dark:hover:bg-green-900/60"
                    }`}
                  >
                    <span>All</span>
                    <span className="tabular-nums opacity-70">
                      {getOptionCount(group.key)}
                    </span>
                  </button>

                  {group.options.map((option) => {
                    const count = getOptionCount(group.key, option.slug);
                    const isActive = activeSlug === option.slug;
                    const isDisabled = count === 0 && !isActive;

                    return (
                      <button
                        key={option.slug}
                        type="button"
                        onClick={() => selectOption(group.key, option.slug)}
                        aria-pressed={isActive}
                        disabled={isDisabled}
                        title={option.description}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ring-1 ring-inset transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 ${
                          isActive
                            ? "bg-green-700 text-white ring-green-700 dark:bg-green-400 dark:text-green-950 dark:ring-green-400"
                            : isDisabled
                              ? "cursor-not-allowed bg-gray-50 text-gray-300 ring-gray-100 dark:bg-green-950/20 dark:text-gray-600 dark:ring-green-900/40"
                              : "bg-gray-50 text-gray-700 ring-gray-200 hover:bg-green-50 hover:text-green-700 dark:bg-green-950/40 dark:text-gray-200 dark:ring-green-700/45 dark:hover:bg-green-900/60"
                        }`}
                      >
                        <span>{option.label}</span>
                        <span className="tabular-nums opacity-70">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-lg font-black text-gray-900 dark:text-white sm:text-xl">
          {page.resultsTitle}
        </h2>
        <span className="text-xs font-semibold tabular-nums text-gray-500 dark:text-gray-300">
          {visibleGames.length} {visibleGames.length === 1 ? "game" : "games"}
        </span>
      </div>

      {visibleGames.length > 0 ? (
        <LiveGameCards games={visibleGames} orderByPopularity />
      ) : (
        <div className="rounded-2xl border border-dashed border-green-200 bg-white px-6 py-14 text-center dark:border-green-700/50 dark:bg-[#0d4021]">
          <p className="font-bold text-gray-800 dark:text-white">
            {page.emptyTitle}
          </p>
          <button
            type="button"
            onClick={clearAllFilters}
            className="mt-3 text-sm font-bold text-green-700 underline-offset-2 hover:underline dark:text-green-300"
          >
            {page.clearLabel}
          </button>
        </div>
      )}
    </>
  );
}
