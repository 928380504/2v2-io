import { getAllTaggedGames } from "@/config/game-tags";
import type { Game } from "@/config/game-catalog";
import type {
  GameFilterAttributes,
  GameFilterConfiguration,
  GameFilterGroupDefinition,
} from "@/config/game-filter-schema";
import { isGameRankingEligible } from "@/site/content/popular-games";
import rawFilterConfiguration from "@/site/game-filters.json";

export const GAME_FILTER_CONFIGURATION =
  rawFilterConfiguration as GameFilterConfiguration;
export const gameFilterGroups: GameFilterGroupDefinition[] =
  GAME_FILTER_CONFIGURATION.groups;
export const primaryGameFilterGroup =
  gameFilterGroups.find(
    (group) => group.key === GAME_FILTER_CONFIGURATION.primaryMatchGroup,
  ) || gameFilterGroups[0];

function deduplicate(values: string[]) {
  return Array.from(new Set(values));
}

function valuesFromDeclaredAttribute(
  value: string | string[] | undefined,
): string[] {
  if (Array.isArray(value)) return deduplicate(value);
  return typeof value === "string" && value ? [value] : [];
}

function fallbackValues(game: Game, group: GameFilterGroupDefinition) {
  const tags = new Set((game.tags || []).map((tag) => tag.trim().toLowerCase()));
  return deduplicate([
    ...group.defaultValues,
    ...group.options
      .filter((option) =>
        (option.tagAliases || []).some((alias) => tags.has(alias.toLowerCase())),
      )
      .map((option) => option.slug),
  ]);
}

export function getGameFilterAttributes(game: Game): GameFilterAttributes {
  return Object.fromEntries(
    gameFilterGroups.map((group) => {
      const declared = valuesFromDeclaredAttribute(
        game.gameAttributes?.[group.attributeKey],
      );
      return [
        group.key,
        declared.length > 0 ? declared : fallbackValues(game, group),
      ];
    }),
  );
}

export function getFilterPageGames(): Game[] {
  return getAllTaggedGames()
    .filter((game) => isGameRankingEligible(game.id))
    .sort((left, right) => (right.plays ?? 0) - (left.plays ?? 0));
}

export function getGameFilterOption(slug: string) {
  const migratedSlug = GAME_FILTER_CONFIGURATION.aliases[slug] || slug;
  for (const group of gameFilterGroups) {
    const option = group.options.find((item) => item.slug === migratedSlug);
    if (option) return { group, option };
  }
  return undefined;
}

export function getPrimaryGameAttributeLabel(slug: string) {
  return (
    primaryGameFilterGroup?.options.find((option) => option.slug === slug)?.label ||
    slug
  );
}

export function getPrimaryGameAttributeLabels(game: Game) {
  if (!primaryGameFilterGroup) return [];
  return getGameFilterAttributes(game)[primaryGameFilterGroup.key].map(
    getPrimaryGameAttributeLabel,
  );
}

export function getPrimaryGameAttributeValues(game: Game) {
  return primaryGameFilterGroup
    ? getGameFilterAttributes(game)[primaryGameFilterGroup.key]
    : [];
}

export type { GameFilterAttributes } from "@/config/game-filter-schema";
