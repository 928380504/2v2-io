import type { Metadata } from "next";
import { gameCategories, type Game } from "@/config/game-catalog";
import { isGameRankingEligible } from "@/site/content/popular-games";
import { SITE_ROUTES } from "@/site/routes";
import { SITE_CONFIG, siteUrl } from "@/site/site";

export const PRIMARY_CATEGORY_PAGE = {
  categoryId: "sci-fi-clicker-games",
  path: SITE_ROUTES.gameCategory,
  heading: "Sci-Fi Clicker Games",
  description: "Discover our collection of addictive clicker games. From candy collecting to planet exploration, find your perfect idle adventure!",
  metadataTitle: "Sci-Fi Clicker Games - Play Online",
  metadataDescription: "Discover our collection of addictive clicker games. From candy collecting to planet exploration, find your perfect idle adventure!",
  socialDescription: "Discover our collection of addictive clicker games. From candy collecting to planet exploration, find your perfect idle adventure!",
  keywords: "2v2.io",
} as const;

export const CATEGORY_PAGES = { primary: PRIMARY_CATEGORY_PAGE } as const;
export type CategoryPageKey = keyof typeof CATEGORY_PAGES;
export type CategoryPageDefinition = typeof PRIMARY_CATEGORY_PAGE;

export function getCategoryPageGames(page: CategoryPageDefinition): Game[] {
  const category = gameCategories.find((item) => item.id === page.categoryId);
  return category ? category.games.filter((game) => isGameRankingEligible(game.id)) : [];
}

export function createCategoryPageMetadata(page: CategoryPageDefinition = PRIMARY_CATEGORY_PAGE): Metadata {
  const canonical = siteUrl(page.path);
  return {
    title: page.metadataTitle, description: page.metadataDescription, keywords: page.keywords,
    metadataBase: new URL(SITE_CONFIG.url), alternates: { canonical },
    openGraph: { title: page.metadataTitle, description: page.socialDescription, url: canonical, type: "website", siteName: SITE_CONFIG.name },
    twitter: { card: "summary", title: page.metadataTitle, description: page.socialDescription },
  };
}
