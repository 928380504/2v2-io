"use client";

import { useEffect, useState } from "react";
import { readLocalApiCache, writeLocalApiCache } from "@/lib/local-api-cache";
import { SITE_FEATURES } from "@/config/features";
import { fetchGameCardStats } from "@/lib/data/game-data-client";
import { DATA_PROVIDER } from "@/config/data-provider";
import { SITE_RUNTIME } from "@/site/runtime";

const CACHE_KEY = SITE_RUNTIME.storage.gameCardStats;
const CACHE_TTL_MS = DATA_PROVIDER.cache.gameCardsMs;
const MAXIMUM_BATCH_SIZE = DATA_PROVIDER.limits.gameCardsBatch;

export interface GameCardStats {
  gameId: string;
  plays: number;
  likes: number;
  favorites: number;
}

interface GameCardStatsCache {
  items: Record<string, GameCardStats>;
  fetchedAt: Record<string, number>;
}

interface GameCardStatsResponse {
  ok: boolean;
  items?: unknown;
}

const requests = new Map<string, Promise<GameCardStats[]>>();

function isFiniteCount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isGameCardStats(value: unknown): value is GameCardStats {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<GameCardStats>;
  return (
    typeof item.gameId === "string" &&
    isFiniteCount(item.plays) &&
    isFiniteCount(item.likes) &&
    isFiniteCount(item.favorites)
  );
}

function isStatsCache(value: unknown): value is GameCardStatsCache {
  if (!value || typeof value !== "object") return false;
  const cache = value as Partial<GameCardStatsCache>;
  return Boolean(
    cache.items &&
      typeof cache.items === "object" &&
      !Array.isArray(cache.items) &&
      cache.fetchedAt &&
      typeof cache.fetchedAt === "object" &&
      !Array.isArray(cache.fetchedAt),
  );
}

function readCache(): GameCardStatsCache {
  return readLocalApiCache(CACHE_KEY, isStatsCache) || {
    items: {},
    fetchedAt: {},
  };
}

async function requestStats(gameIds: string[]) {
  const key = [...gameIds].sort().join(",");
  const existing = requests.get(key);
  if (existing) return existing;

  const request = (async () => {
    const payload = await fetchGameCardStats<GameCardStatsResponse>(gameIds);
    if (!payload.ok || !Array.isArray(payload.items)) {
      throw new Error("Invalid game card statistics response.");
    }

    return payload.items.filter(isGameCardStats);
  })().finally(() => {
    requests.delete(key);
  });

  requests.set(key, request);
  return request;
}

function chunkGameIds(gameIds: string[]) {
  const chunks: string[][] = [];
  for (let index = 0; index < gameIds.length; index += MAXIMUM_BATCH_SIZE) {
    chunks.push(gameIds.slice(index, index + MAXIMUM_BATCH_SIZE));
  }
  return chunks;
}

export function useGameCardStats(gameIds: string[]) {
  const normalizedIds = Array.from(new Set(gameIds.filter(Boolean))).sort();
  const idsKey = normalizedIds.join("|");
  const [items, setItems] = useState<Record<string, GameCardStats>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!SITE_FEATURES.engagement) {
      setItems({});
      setIsRefreshing(false);
      return;
    }

    let isActive = true;
    const requestedIds = idsKey ? idsKey.split("|") : [];
    const cache = readCache();
    const now = Date.now();
    const cachedItems = Object.fromEntries(
      requestedIds.flatMap((gameId) =>
        cache.items[gameId] ? [[gameId, cache.items[gameId]]] : [],
      ),
    );
    setItems(cachedItems);

    const staleIds = requestedIds.filter((gameId) =>
      !cache.items[gameId] || now - Number(cache.fetchedAt[gameId] || 0) >= CACHE_TTL_MS,
    );
    if (staleIds.length === 0) {
      setIsRefreshing(false);
      return () => {
        isActive = false;
      };
    }

    setIsRefreshing(true);
    void Promise.all(chunkGameIds(staleIds).map((batch) => requestStats(batch)))
      .then((batches) => batches.flat())
      .then((freshItems) => {
        if (!isActive) return;
        const latestCache = readCache();
        const fetchedAt = Date.now();
        freshItems.forEach((item) => {
          latestCache.items[item.gameId] = item;
          latestCache.fetchedAt[item.gameId] = fetchedAt;
        });
        writeLocalApiCache(CACHE_KEY, latestCache);
        setItems((current) => ({
          ...current,
          ...Object.fromEntries(freshItems.map((item) => [item.gameId, item])),
        }));
      })
      .catch(() => undefined)
      .finally(() => {
        if (isActive) setIsRefreshing(false);
      });

    return () => {
      isActive = false;
    };
  }, [idsKey]);

  return { items, isRefreshing };
}
