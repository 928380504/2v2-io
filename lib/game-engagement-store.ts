import { SITE_RUNTIME } from "@/site/runtime";

export const GAME_ENGAGEMENT_STORAGE_KEY = SITE_RUNTIME.storage.engagement;
export const GAME_ENGAGEMENT_CHANGED_EVENT = SITE_RUNTIME.events.engagementChanged;

export type GameReaction = "like" | "dislike" | null;

export interface GameEngagementCounts {
  plays: number;
  likes: number;
  dislikes: number;
  favorites: number;
}

export interface GameEngagementViewer {
  reaction: GameReaction;
  favorite: boolean;
  lastPlayAt: number | null;
  likeVotesUsed: number;
  dislikeVotesUsed: number;
  localOnlyLikes: number;
  localOnlyDislikes: number;
}

export interface GameEngagementSnapshot {
  gameId: string;
  counts: GameEngagementCounts;
  viewer: GameEngagementViewer;
  savedAt: number;
}

interface StoredGameEngagement extends GameEngagementSnapshot {
  visitorId: string;
}

type StoredGameEngagements = Record<string, StoredGameEngagement>;

let memoryEngagements: StoredGameEngagements = {};

function normalizeCount(value: unknown) {
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}

function normalizeTimestamp(value: unknown) {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
}

function readStoredEngagements(): StoredGameEngagements {
  if (typeof window === "undefined") return memoryEngagements;
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(GAME_ENGAGEMENT_STORAGE_KEY) || "{}",
    );
    memoryEngagements = parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
    return memoryEngagements;
  } catch {
    return memoryEngagements;
  }
}

function normalizeStoredEngagement(
  value: unknown,
  gameId: string,
  visitorId: string,
): GameEngagementSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<StoredGameEngagement>;
  if (candidate.gameId !== gameId || candidate.visitorId !== visitorId) return null;
  if (!candidate.counts || !candidate.viewer) return null;

  const reaction = candidate.viewer.reaction === "like" || candidate.viewer.reaction === "dislike"
    ? candidate.viewer.reaction
    : null;
  const savedAt = normalizeTimestamp(candidate.savedAt);
  if (savedAt === null) return null;

  return {
    gameId,
    counts: {
      plays: normalizeCount(candidate.counts.plays),
      likes: normalizeCount(candidate.counts.likes),
      dislikes: normalizeCount(candidate.counts.dislikes),
      favorites: normalizeCount(candidate.counts.favorites),
    },
    viewer: {
      reaction,
      favorite: candidate.viewer.favorite === true,
      lastPlayAt: normalizeTimestamp(candidate.viewer.lastPlayAt),
      likeVotesUsed: Math.min(5, normalizeCount(candidate.viewer.likeVotesUsed)),
      dislikeVotesUsed: Math.min(5, normalizeCount(candidate.viewer.dislikeVotesUsed)),
      localOnlyLikes: normalizeCount(candidate.viewer.localOnlyLikes),
      localOnlyDislikes: normalizeCount(candidate.viewer.localOnlyDislikes),
    },
    savedAt,
  };
}

export function createEmptyGameEngagement(gameId: string): GameEngagementSnapshot {
  return {
    gameId,
    counts: { plays: 0, likes: 0, dislikes: 0, favorites: 0 },
    viewer: {
      reaction: null,
      favorite: false,
      lastPlayAt: null,
      likeVotesUsed: 0,
      dislikeVotesUsed: 0,
      localOnlyLikes: 0,
      localOnlyDislikes: 0,
    },
    savedAt: 0,
  };
}

export function getStoredGameEngagement(gameId: string, visitorId: string) {
  return normalizeStoredEngagement(
    readStoredEngagements()[gameId],
    gameId,
    visitorId,
  );
}

export function saveGameEngagement(
  snapshot: Omit<GameEngagementSnapshot, "savedAt"> & { savedAt?: number },
  visitorId: string,
) {
  if (typeof window === "undefined") return;
  const engagements = readStoredEngagements();
  const stored: StoredGameEngagement = {
    ...snapshot,
    counts: {
      plays: normalizeCount(snapshot.counts.plays),
      likes: normalizeCount(snapshot.counts.likes),
      dislikes: normalizeCount(snapshot.counts.dislikes),
      favorites: normalizeCount(snapshot.counts.favorites),
    },
    viewer: {
      reaction: snapshot.viewer.reaction === "like" || snapshot.viewer.reaction === "dislike"
        ? snapshot.viewer.reaction
        : null,
      favorite: snapshot.viewer.favorite === true,
      lastPlayAt: normalizeTimestamp(snapshot.viewer.lastPlayAt),
      likeVotesUsed: Math.min(5, normalizeCount(snapshot.viewer.likeVotesUsed)),
      dislikeVotesUsed: Math.min(5, normalizeCount(snapshot.viewer.dislikeVotesUsed)),
      localOnlyLikes: normalizeCount(snapshot.viewer.localOnlyLikes),
      localOnlyDislikes: normalizeCount(snapshot.viewer.localOnlyDislikes),
    },
    savedAt: snapshot.savedAt || Date.now(),
    visitorId,
  };
  engagements[snapshot.gameId] = stored;
  memoryEngagements = engagements;

  try {
    window.localStorage.setItem(
      GAME_ENGAGEMENT_STORAGE_KEY,
      JSON.stringify(engagements),
    );
  } catch {
    // Live state remains available in memory when storage is blocked.
  }

  window.dispatchEvent(
    new CustomEvent(GAME_ENGAGEMENT_CHANGED_EVENT, {
      detail: { gameId: snapshot.gameId },
    }),
  );
}
