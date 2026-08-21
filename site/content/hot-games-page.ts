import type { Metadata } from "next";
import { gameCategories, type Game } from "@/config/game-catalog";
import { sortByPopularGameOrder } from "@/config/popular-games";
import { SITE_ROUTES } from "@/site/routes";
import { SITE_CONFIG, siteUrl } from "@/site/site";

export const HOT_GAMES_PAGE = {
  path: SITE_ROUTES.hotGames,
  heading: "Hot Games",
  description: "Browse the games receiving the most real play activity.",
  limit: 7,
  metadataTitle: "Hot Games - 2v2.io",
  metadataDescription: "Browse popular browser games ranked by real play activity.",
  socialDescription: "Browse popular browser games.",
  keywords: "hot games, popular games, 2v2.io",
} as const;

export function getHotGames(): Game[] {
  return sortByPopularGameOrder(gameCategories.flatMap((category) => category.games), {});
}

export function createHotGamesMetadata(): Metadata {
  const canonical = siteUrl(HOT_GAMES_PAGE.path);
  return { title: HOT_GAMES_PAGE.metadataTitle, description: HOT_GAMES_PAGE.metadataDescription, keywords: HOT_GAMES_PAGE.keywords, metadataBase: new URL(SITE_CONFIG.url), alternates: { canonical }, openGraph: { title: HOT_GAMES_PAGE.metadataTitle, description: HOT_GAMES_PAGE.socialDescription, url: canonical, type: "website", siteName: SITE_CONFIG.name }, twitter: { card: "summary", title: HOT_GAMES_PAGE.metadataTitle, description: HOT_GAMES_PAGE.socialDescription } };
}
