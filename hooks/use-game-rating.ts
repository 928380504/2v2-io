"use client";

import { useEffect, useMemo, useState } from "react";
import {
  GAME_RATING_CHANGED_EVENT,
  GAME_REMOTE_RATING_FETCHED_AT_STORAGE_KEY,
  GAME_REMOTE_RATING_STORAGE_KEY,
  GAME_RATING_STORAGE_KEY,
  getGameRatingSnapshot,
  getSeedRatingSnapshot,
  type GameRatingSeed,
  type GameRatingSnapshot,
} from "@/lib/game-rating-store";
import { queueRemoteGameRating } from "@/lib/game-rating-client";
import generatedRatings from "@/site/generated/ratings.generated.json";
import { SITE_FEATURES } from "@/config/features";

interface GameRatingSource {
  id: string;
  rating?: number;
  ratingCount?: number;
}

const buildRatings = generatedRatings as Record<string, GameRatingSeed>;

function resolveBuildRatingSeed(gameId: string, seed: GameRatingSeed) {
  const generated = buildRatings[gameId];
  return generated &&
      Number.isFinite(generated.score) &&
      Number.isInteger(generated.votes) &&
      generated.votes >= 0
    ? generated
    : seed;
}

export function useGameRating(
  gameId: string,
  seed: GameRatingSeed,
): GameRatingSnapshot {
  const buildSeed = resolveBuildRatingSeed(gameId, seed);
  const seedScore = Number.isFinite(buildSeed.score) ? buildSeed.score : 0;
  const seedVotes = Number.isFinite(buildSeed.votes) ? buildSeed.votes : 0;
  const [rating, setRating] = useState(() =>
    getSeedRatingSnapshot(gameId, {
      score: seedScore,
      votes: seedVotes,
    }),
  );

  useEffect(() => {
    if (!SITE_FEATURES.ratings) return;

    const currentSeed = { score: seedScore, votes: seedVotes };
    const refreshRating = () => {
      setRating(getGameRatingSnapshot(gameId, currentSeed));
    };
    const handleRatingChange = (event: Event) => {
      const changedGameId = (event as CustomEvent<{ gameId?: string }>).detail
        ?.gameId;
      if (!changedGameId || changedGameId === gameId) refreshRating();
    };
    const handleStorageChange = (event: StorageEvent) => {
      if (
        event.key === GAME_RATING_STORAGE_KEY ||
        event.key === GAME_REMOTE_RATING_STORAGE_KEY ||
        event.key === GAME_REMOTE_RATING_FETCHED_AT_STORAGE_KEY
      ) {
        refreshRating();
      }
    };

    refreshRating();
    queueRemoteGameRating(gameId);
    window.addEventListener(GAME_RATING_CHANGED_EVENT, handleRatingChange);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener(GAME_RATING_CHANGED_EVENT, handleRatingChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [gameId, seedScore, seedVotes]);

  return rating;
}

export function useGameRatings(games: GameRatingSource[]) {
  const seeds = useMemo(
    () => games.map((game) => ({
      gameId: game.id,
      seed: resolveBuildRatingSeed(game.id, {
        score: Number.isFinite(game.rating) ? Number(game.rating) : 0,
        votes: Number.isFinite(game.ratingCount) ? Number(game.ratingCount) : 0,
      }),
    })),
    [games],
  );
  const [ratings, setRatings] = useState<Record<string, GameRatingSnapshot>>(
    () => Object.fromEntries(
      seeds.map(({ gameId, seed }) => [
        gameId,
        getSeedRatingSnapshot(gameId, seed),
      ]),
    ),
  );

  useEffect(() => {
    if (!SITE_FEATURES.ratings) return;

    const refreshRatings = () => {
      setRatings(Object.fromEntries(
        seeds.map(({ gameId, seed }) => [
          gameId,
          getGameRatingSnapshot(gameId, seed),
        ]),
      ));
    };
    const handleRatingChange = (event: Event) => {
      const changedGameId = (event as CustomEvent<{ gameId?: string }>).detail
        ?.gameId;
      if (!changedGameId || seeds.some(({ gameId }) => gameId === changedGameId)) {
        refreshRatings();
      }
    };
    const handleStorageChange = (event: StorageEvent) => {
      if (
        event.key === GAME_RATING_STORAGE_KEY ||
        event.key === GAME_REMOTE_RATING_STORAGE_KEY ||
        event.key === GAME_REMOTE_RATING_FETCHED_AT_STORAGE_KEY
      ) {
        refreshRatings();
      }
    };

    refreshRatings();
    seeds.forEach(({ gameId }) => queueRemoteGameRating(gameId));
    window.addEventListener(GAME_RATING_CHANGED_EVENT, handleRatingChange);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener(GAME_RATING_CHANGED_EVENT, handleRatingChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [seeds]);

  return ratings;
}
