import { gameCategories, type Game } from "@/config/game-catalog";
import { isGameRankingEligible } from "@/config/popular-games";

export interface GameTagSummary {
  name: string;
  slug: string;
  count: number;
}

function normalizeTag(tag: string) {
  return tag.trim().toLowerCase();
}

export function getGameTagSlug(tag: string) {
  return normalizeTag(tag)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getAllTaggedGames(): Game[] {
  return Array.from(
    new Map(
      gameCategories
        .flatMap((category) => category.games)
        .map((game) => [game.id, game]),
    ).values(),
  ).filter((game) => isGameRankingEligible(game.id));
}

const tagSummaries = (() => {
  const tags = new Map<string, GameTagSummary>();

  getAllTaggedGames().forEach((game) => {
    const uniqueGameTags = new Set((game.tags || []).map(normalizeTag));

    uniqueGameTags.forEach((normalizedTag) => {
      const originalTag = (game.tags || []).find(
        (tag) => normalizeTag(tag) === normalizedTag,
      );
      if (!originalTag) return;

      const existing = tags.get(normalizedTag);
      if (existing) {
        existing.count += 1;
        return;
      }

      tags.set(normalizedTag, {
        name: originalTag.trim(),
        slug: getGameTagSlug(originalTag),
        count: 1,
      });
    });
  });

  return Array.from(tags.values()).sort(
    (left, right) =>
      right.count - left.count || left.name.localeCompare(right.name),
  );
})();

export function getAllGameTagSummaries(): GameTagSummary[] {
  return tagSummaries.map((tag) => ({ ...tag }));
}

export function getGameTagCount(tag: string) {
  const normalizedTag = normalizeTag(tag);
  return tagSummaries.find(
    (summary) => normalizeTag(summary.name) === normalizedTag,
  )?.count ?? 0;
}
