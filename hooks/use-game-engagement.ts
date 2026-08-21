"use client";

import { useCallback, useEffect, useState } from "react";
import {
  GAME_ENGAGEMENT_CHANGED_EVENT,
  GAME_ENGAGEMENT_STORAGE_KEY,
  createEmptyGameEngagement,
  getStoredGameEngagement,
  saveGameEngagement,
  type GameEngagementSnapshot,
} from "@/lib/game-engagement-store";
import { getSiteVisitorId } from "@/lib/site-visitor";
import { SITE_FEATURES } from "@/config/features";
import {
  fetchGameEngagement,
  updateGameEngagement,
  type EngagementAction,
} from "@/lib/data/game-data-client";
import { DATA_PROVIDER } from "@/config/data-provider";

const ENGAGEMENT_CACHE_TTL_MS = DATA_PROVIDER.cache.engagementMs;
const PLAY_COOLDOWN_MS = 30 * 60 * 1000;

interface EngagementApiResponse {
  ok: boolean;
  gameId?: unknown;
  counts?: unknown;
  viewer?: unknown;
  accepted?: unknown;
}

const readRequests = new Map<string, Promise<GameEngagementSnapshot>>();
const mutationQueues = new Map<string, Promise<void>>();
const mutationVersions = new Map<string, number>();

function normalizeCount(value: unknown) {
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}

function parseSnapshot(
  payload: EngagementApiResponse,
  gameId: string,
  fallbackViewer?: GameEngagementSnapshot["viewer"],
): Omit<GameEngagementSnapshot, "savedAt"> {
  if (!payload.ok || payload.gameId !== gameId) {
    throw new Error("Invalid engagement response.");
  }
  const counts = payload.counts as Record<string, unknown> | undefined;
  const viewer = payload.viewer as Record<string, unknown> | undefined;
  const reaction = viewer?.reaction === "like" || viewer?.reaction === "dislike"
    ? viewer.reaction
    : (fallbackViewer?.reaction ?? null);
  const lastPlayAtValue = Number(viewer?.lastPlayAt);
  const localOnlyLikes = fallbackViewer?.localOnlyLikes ?? 0;
  const localOnlyDislikes = fallbackViewer?.localOnlyDislikes ?? 0;

  return {
    gameId,
    counts: {
      plays: normalizeCount(counts?.plays),
      likes: normalizeCount(counts?.likes) + localOnlyLikes,
      dislikes: normalizeCount(counts?.dislikes) + localOnlyDislikes,
      favorites: normalizeCount(counts?.favorites),
    },
    viewer: {
      reaction,
      favorite: typeof viewer?.favorite === "boolean"
        ? viewer.favorite
        : (fallbackViewer?.favorite ?? false),
      lastPlayAt: Number.isFinite(lastPlayAtValue) && lastPlayAtValue > 0
        ? lastPlayAtValue
        : (fallbackViewer?.lastPlayAt ?? null),
      likeVotesUsed: viewer?.likeVotesUsed === undefined
        ? (fallbackViewer?.likeVotesUsed ?? 0)
        : Math.min(5, normalizeCount(viewer.likeVotesUsed)),
      dislikeVotesUsed: viewer?.dislikeVotesUsed === undefined
        ? (fallbackViewer?.dislikeVotesUsed ?? 0)
        : Math.min(5, normalizeCount(viewer.dislikeVotesUsed)),
      localOnlyLikes,
      localOnlyDislikes,
    },
  };
}

function requestKey(gameId: string, visitorId: string) {
  return `${gameId}:${visitorId}`;
}

async function loadEngagement(
  gameId: string,
  visitorId: string,
  force = false,
) {
  const cached = getStoredGameEngagement(gameId, visitorId);
  if (!force && cached && Date.now() - cached.savedAt < ENGAGEMENT_CACHE_TTL_MS) {
    return cached;
  }

  const key = requestKey(gameId, visitorId);
  const existingRequest = readRequests.get(key);
  if (existingRequest) return existingRequest;
  const versionAtStart = mutationVersions.get(key) || 0;
  const request = (async () => {
    const payload = await fetchGameEngagement<EngagementApiResponse>(
      gameId,
      visitorId,
    );
    const snapshot = parseSnapshot(
      payload,
      gameId,
      cached?.viewer,
    );
    if ((mutationVersions.get(key) || 0) === versionAtStart) {
      saveGameEngagement(snapshot, visitorId);
      return getStoredGameEngagement(gameId, visitorId) || {
        ...snapshot,
        savedAt: Date.now(),
      };
    }
    return getStoredGameEngagement(gameId, visitorId) || {
      ...snapshot,
      savedAt: Date.now(),
    };
  })().finally(() => {
    readRequests.delete(key);
  });
  readRequests.set(key, request);
  return request;
}

function enqueueMutation(key: string, task: () => Promise<void>) {
  mutationVersions.set(key, (mutationVersions.get(key) || 0) + 1);
  const previous = mutationQueues.get(key) || Promise.resolve();
  const next = previous.catch(() => undefined).then(task);
  mutationQueues.set(key, next);
  void next
    .finally(() => {
      if (mutationQueues.get(key) === next) mutationQueues.delete(key);
    })
    .catch(() => undefined);
  return next;
}

function createOptimisticSnapshot(
  current: GameEngagementSnapshot,
  action: EngagementAction,
) {
  const next: GameEngagementSnapshot = {
    gameId: current.gameId,
    counts: { ...current.counts },
    viewer: { ...current.viewer },
    savedAt: Date.now(),
  };

  if (action === "play") {
    const canCount = !next.viewer.lastPlayAt ||
      Date.now() - next.viewer.lastPlayAt >= PLAY_COOLDOWN_MS;
    if (canCount) {
      next.counts.plays += 1;
      next.viewer.lastPlayAt = Date.now();
    }
    return next;
  }

  if (action === "favorite") {
    next.counts.favorites += 1;
    return next;
  }

  if (action === "like") next.counts.likes += 1;
  if (action === "like") {
    next.viewer.likeVotesUsed = Math.min(5, next.viewer.likeVotesUsed + 1);
  }
  if (action === "dislike") {
    next.counts.dislikes += 1;
    next.viewer.dislikeVotesUsed = Math.min(5, next.viewer.dislikeVotesUsed + 1);
  }
  return next;
}

function createLocalOnlySnapshot(
  current: GameEngagementSnapshot,
  action: "like" | "dislike",
) {
  const next: GameEngagementSnapshot = {
    gameId: current.gameId,
    counts: { ...current.counts },
    viewer: { ...current.viewer },
    savedAt: Date.now(),
  };
  if (action === "like") {
    next.counts.likes += 1;
    next.viewer.localOnlyLikes += 1;
  } else {
    next.counts.dislikes += 1;
    next.viewer.localOnlyDislikes += 1;
  }
  return next;
}

export function useGameEngagement(gameId: string) {
  const [visitorId, setVisitorId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState(() =>
    createEmptyGameEngagement(gameId)
  );
  const [isLoaded, setIsLoaded] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (!SITE_FEATURES.engagement) {
      setSnapshot(createEmptyGameEngagement(gameId));
      setIsLoaded(true);
      setIsUpdating(false);
      return;
    }

    const nextVisitorId = getSiteVisitorId();
    setVisitorId(nextVisitorId);
    const cached = getStoredGameEngagement(gameId, nextVisitorId);
    setSnapshot(cached || createEmptyGameEngagement(gameId));
    setIsLoaded(Boolean(cached));

    const refreshFromStore = () => {
      const current = getStoredGameEngagement(gameId, nextVisitorId);
      if (current) {
        setSnapshot(current);
        setIsLoaded(true);
      }
    };
    const handleEngagementChange = (event: Event) => {
      const changedGameId = (event as CustomEvent<{ gameId?: string }>).detail
        ?.gameId;
      if (!changedGameId || changedGameId === gameId) refreshFromStore();
    };
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === GAME_ENGAGEMENT_STORAGE_KEY) refreshFromStore();
    };

    void loadEngagement(gameId, nextVisitorId)
      .then(() => refreshFromStore())
      .catch(() => undefined);
    window.addEventListener(GAME_ENGAGEMENT_CHANGED_EVENT, handleEngagementChange);
    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener(GAME_ENGAGEMENT_CHANGED_EVENT, handleEngagementChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [gameId]);

  const mutate = useCallback(async (action: EngagementAction) => {
    if (!SITE_FEATURES.engagement) return false;
    const resolvedVisitorId = visitorId || getSiteVisitorId();
    if (!visitorId) setVisitorId(resolvedVisitorId);
    const key = requestKey(gameId, resolvedVisitorId);
    setIsUpdating(true);
    try {
      await enqueueMutation(key, async () => {
        const previous = getStoredGameEngagement(gameId, resolvedVisitorId) || snapshot;
        if (
          (action === "like" && previous.viewer.likeVotesUsed >= 5) ||
          (action === "dislike" && previous.viewer.dislikeVotesUsed >= 5)
        ) {
          saveGameEngagement(
            createLocalOnlySnapshot(previous, action),
            resolvedVisitorId,
          );
          return;
        }
        const optimistic = createOptimisticSnapshot(previous, action);
        saveGameEngagement(optimistic, resolvedVisitorId);
        try {
          const payload = await updateGameEngagement<EngagementApiResponse>(
            gameId,
            resolvedVisitorId,
            action,
          );
          let confirmed: Omit<GameEngagementSnapshot, "savedAt"> = parseSnapshot(
            payload,
            gameId,
            optimistic.viewer,
          );
          if (
            payload.accepted === false &&
            (action === "like" || action === "dislike")
          ) {
            confirmed = createLocalOnlySnapshot(
              { ...confirmed, savedAt: Date.now() },
              action,
            );
          }
          saveGameEngagement(confirmed, resolvedVisitorId);
        } catch (error) {
          saveGameEngagement(previous, resolvedVisitorId);
          throw error;
        }
      });
      return true;
    } catch {
      return false;
    } finally {
      setIsUpdating(false);
    }
  }, [gameId, snapshot, visitorId]);

  const recordPlay = useCallback(() => {
    const resolvedVisitorId = visitorId || getSiteVisitorId();
    const current = getStoredGameEngagement(gameId, resolvedVisitorId) || snapshot;
    if (
      current.viewer.lastPlayAt &&
      Date.now() - current.viewer.lastPlayAt < PLAY_COOLDOWN_MS
    ) {
      return Promise.resolve(true);
    }
    return mutate("play");
  }, [gameId, mutate, snapshot, visitorId]);
  const recordLike = useCallback(() => mutate("like"), [mutate]);
  const recordDislike = useCallback(() => mutate("dislike"), [mutate]);
  const recordFavorite = useCallback(
    () => mutate("favorite"),
    [mutate],
  );

  return {
    ...snapshot,
    isLoaded,
    isUpdating,
    recordPlay,
    recordLike,
    recordDislike,
    recordFavorite,
  };
}
