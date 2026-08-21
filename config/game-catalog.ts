import type { Metadata } from "next";
import { GAME_DEFINITIONS } from "@/config/game-catalog-data";
import { GAME_CATEGORY_DEFINITIONS } from "@/site/content/game-categories";
import type {
  Game,
  GameCatalogEntry,
  GameCategory,
  GameDetailPageData,
} from "@/config/game-schema";
import { gameDetailPath } from "@/config/routes";
import { SITE_CONFIG, siteUrl } from "@/config/site";

export type GameId = keyof typeof GAME_DEFINITIONS;
export type GameDetailPageId = GameId;

const gameCatalogEntries = Object.entries(GAME_DEFINITIONS).map(
  ([id, definition]) => {
    const { categoryId, detail, ...game } = definition;
    if (!(categoryId in GAME_CATEGORY_DEFINITIONS)) {
      throw new Error(`Unknown category ${categoryId} for game ${id}.`);
    }

    return {
      ...game,
      id,
      url: gameDetailPath(id),
      categoryId,
      detail,
    } as GameCatalogEntry;
  },
);

const gameCatalog = new Map(
  gameCatalogEntries.map((game) => [game.id, game]),
);

export const gameCategories: GameCategory[] = Object.entries(
  GAME_CATEGORY_DEFINITIONS,
).map(([id, category]) => ({
  id,
  ...category,
  games: gameCatalogEntries.filter((game) => game.categoryId === id),
}));

export function getAllGames(): GameCatalogEntry[] {
  return [...gameCatalogEntries];
}

export function getGame(gameId: string): GameCatalogEntry | undefined {
  return gameCatalog.get(gameId);
}

export function getGameCategory(
  categoryId: string,
): GameCategory | undefined {
  return gameCategories.find((category) => category.id === categoryId);
}

export function getGamesByCategory(categoryId: string): GameCatalogEntry[] {
  return getGameCategory(categoryId)?.games ?? [];
}

export interface GamePageContext {
  game: GameCatalogEntry;
  category: GameCategory;
  detail: GameDetailPageData;
  playableGame: GameCatalogEntry & {
    playUrl: string;
    category: string;
    categoryUrl: string;
  };
  relatedGames: GameCatalogEntry[];
}

/** Shared source for the homepage primary game and every generated game page. */
export function getGamePageContext(gameId: string): GamePageContext | undefined {
  const game = getGame(gameId);
  const category = game ? getGameCategory(game.categoryId) : undefined;
  if (!game || !category) return undefined;

  return {
    game,
    category,
    detail: game.detail,
    playableGame: {
      ...game,
      playUrl: game.detail.playUrl,
      category: category.title,
      categoryUrl: category.path,
    },
    relatedGames: category.games.filter((item) => item.id !== game.id),
  };
}

export function getGameDetailPageIds(): GameDetailPageId[] {
  return Object.keys(GAME_DEFINITIONS) as GameDetailPageId[];
}

export function isGameDetailPageId(
  gameId: string,
): gameId is GameDetailPageId {
  return Object.prototype.hasOwnProperty.call(GAME_DEFINITIONS, gameId);
}

export function getGameDetailPage(
  gameId: GameDetailPageId,
): GameDetailPageData {
  return GAME_DEFINITIONS[gameId].detail;
}

export function createGameDetailMetadata(gameId: GameDetailPageId): Metadata {
  const game = getGame(gameId);
  if (!game) return {};

  const title = `${game.title} - Play Online for Free!`;
  const image = {
    url: game.image,
    width: 100,
    height: 100,
    alt: game.title,
  };

  return {
    metadataBase: new URL(SITE_CONFIG.url),
    alternates: {
      canonical: siteUrl(game.url),
    },
    title,
    description: game.detail.metadataDescription,
    openGraph: {
      title,
      description: game.detail.metadataDescription,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: game.description,
      images: [image],
    },
  };
}

export function seededRandom(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index);
    hash &= hash;
  }
  return (Math.abs(hash) % 1000) / 1000;
}

export type { Game, GameCatalogEntry, GameCategory } from "@/config/game-schema";
