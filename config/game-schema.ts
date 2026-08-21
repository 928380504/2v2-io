export type GameAttributes = Record<string, string | string[] | undefined>;

export interface Game {
  id: string;
  title: string;
  image: string;
  url: string;
  plays?: number;
  rating?: number;
  ratingCount?: number;
  favorites?: number;
  likes?: number;
  description?: string;
  videoUrl?: string;
  isHot?: boolean;
  tags?: string[];
  gameAttributes?: GameAttributes;
  developer?: string;
  siteAddedAt?: string;
  createdAt?: string;
  platforms?: string[];
  technology?: string;
  matchBridge?: boolean;
}

export interface GameDetailYouTube {
  videoId: string;
  title: string;
  description: string;
}

export interface GameDetailPageData {
  playUrl: string;
  coverImage: string;
  coverAlt: string;
  description: string;
  metadataDescription: string;
  youtube?: GameDetailYouTube;
}

export type GameDefinitionData = Omit<Game, "id" | "url"> & {
  categoryId: string;
  detail: GameDetailPageData;
};

export interface GameCatalogEntry extends Game {
  categoryId: string;
  detail: GameDetailPageData;
}

export interface GameCategory {
  id: string;
  title: string;
  path: string;
  description: string;
  games: GameCatalogEntry[];
}
