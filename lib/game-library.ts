import { SITE_RUNTIME } from "@/site/runtime";

export const FAVORITE_GAMES_STORAGE_KEY = SITE_RUNTIME.storage.favorites;
export const RECENT_GAMES_STORAGE_KEY = SITE_RUNTIME.storage.recents;
export const GAME_LIBRARY_CHANGED_EVENT = SITE_RUNTIME.events.libraryChanged;

const MAX_FAVORITES = 50;
const MAX_RECENTS = 20;

export interface LibraryGame {
  id: string;
  title: string;
  image: string;
  url: string;
  timestamp: number;
}

export type LibraryGameInput = Omit<LibraryGame, "timestamp">;

const isLibraryGame = (value: unknown): value is LibraryGame => {
  if (!value || typeof value !== "object") return false;
  const game = value as Partial<LibraryGame>;
  return (
    typeof game.id === "string" &&
    game.id.length > 0 &&
    typeof game.title === "string" &&
    game.title.length > 0 &&
    typeof game.image === "string" &&
    typeof game.url === "string" &&
    game.url.length > 0 &&
    typeof game.timestamp === "number" &&
    Number.isFinite(game.timestamp)
  );
};

const readGames = (key: string): LibraryGame[] => {
  if (typeof window === "undefined") return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isLibraryGame);
  } catch {
    return [];
  }
};

const writeGames = (key: string, games: LibraryGame[]) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(games));
  window.dispatchEvent(new CustomEvent(GAME_LIBRARY_CHANGED_EVENT));
};

export const getFavoriteGames = () =>
  readGames(FAVORITE_GAMES_STORAGE_KEY).slice(0, MAX_FAVORITES);

export const getRecentGames = () =>
  readGames(RECENT_GAMES_STORAGE_KEY).slice(0, MAX_RECENTS);

export const isFavoriteGame = (gameId: string) =>
  getFavoriteGames().some((game) => game.id === gameId);

export const toggleFavoriteGame = (game: LibraryGameInput) => {
  const favorites = getFavoriteGames();
  const existingIndex = favorites.findIndex((item) => item.id === game.id);

  if (existingIndex >= 0) {
    favorites.splice(existingIndex, 1);
    writeGames(FAVORITE_GAMES_STORAGE_KEY, favorites);
    return false;
  }

  writeGames(
    FAVORITE_GAMES_STORAGE_KEY,
    [{ ...game, timestamp: Date.now() }, ...favorites].slice(0, MAX_FAVORITES),
  );
  return true;
};

export const removeFavoriteGame = (gameId: string) => {
  const favorites = getFavoriteGames().filter((game) => game.id !== gameId);
  writeGames(FAVORITE_GAMES_STORAGE_KEY, favorites);
};

export const recordRecentGame = (game: LibraryGameInput) => {
  const recents = getRecentGames().filter((item) => item.id !== game.id);
  writeGames(
    RECENT_GAMES_STORAGE_KEY,
    [{ ...game, timestamp: Date.now() }, ...recents].slice(0, MAX_RECENTS),
  );
};

export const removeRecentGame = (gameId: string) => {
  const recents = getRecentGames().filter((game) => game.id !== gameId);
  writeGames(RECENT_GAMES_STORAGE_KEY, recents);
};
