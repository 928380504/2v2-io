import { SITE_RUNTIME } from "@/site/runtime";

export const GAME_RATING_STORAGE_KEY = SITE_RUNTIME.storage.ratings;
export const GAME_REMOTE_RATING_STORAGE_KEY = SITE_RUNTIME.storage.remoteRatings;
export const GAME_REMOTE_RATING_FETCHED_AT_STORAGE_KEY = SITE_RUNTIME.storage.remoteRatingsFetchedAt;
export const GAME_RATING_CHANGED_EVENT = SITE_RUNTIME.events.ratingChanged;
export const DEFAULT_GAME_RATING_PRIOR_SCORE = 5;
export const DEFAULT_GAME_RATING_PRIOR_WEIGHT = 50;

export function getPublicRatingCount(realVotes: number) {
  return normalizeVotes(realVotes) + DEFAULT_GAME_RATING_PRIOR_WEIGHT;
}

export interface GameRatingSeed {
  score: number;
  votes: number;
}

export interface GameRatingSnapshot {
  gameId: string;
  /** Bayesian-smoothed score used by visible UI. */
  score: number;
  /** Unadjusted average from real D1 ratings. */
  rawScore: number;
  /** Real D1 rating count. Use getPublicRatingCount() for public/SEO totals. */
  votes: number;
  localVotes: number;
  localScoreTotal: number;
  updatedAt: number | null;
}

interface StoredGameRating {
  localVotes: number;
  localScoreTotal: number;
  updatedAt: number;
}

type StoredGameRatings = Record<string, StoredGameRating>;
type RemoteGameRatings = Record<string, GameRatingSeed>;
type RemoteRatingFetchTimes = Record<string, number>;

let memoryRatings: StoredGameRatings = {};
let memoryRemoteRatings: RemoteGameRatings = {};
let memoryRemoteRatingFetchTimes: RemoteRatingFetchTimes = {};

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(5, Math.max(0, value));
}

function normalizeVotes(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function normalizeSeed(seed: GameRatingSeed): GameRatingSeed {
  return {
    score: clampScore(seed.score),
    votes: normalizeVotes(seed.votes),
  };
}

function calculateRatingScores(scoreTotal: number, votes: number) {
  const normalizedVotes = normalizeVotes(votes);
  const normalizedTotal = Number.isFinite(scoreTotal)
    ? Math.min(normalizedVotes * 5, Math.max(0, scoreTotal))
    : 0;
  const rawScore = normalizedVotes > 0
    ? normalizedTotal / normalizedVotes
    : 0;
  const score = (
    normalizedTotal +
    (DEFAULT_GAME_RATING_PRIOR_SCORE * DEFAULT_GAME_RATING_PRIOR_WEIGHT)
  ) / (normalizedVotes + DEFAULT_GAME_RATING_PRIOR_WEIGHT);

  return {
    score: clampScore(score),
    rawScore: clampScore(rawScore),
    votes: normalizedVotes,
  };
}

function readStoredRatings(): StoredGameRatings {
  if (typeof window === "undefined") return memoryRatings;

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(GAME_RATING_STORAGE_KEY) || "{}",
    );
    memoryRatings = parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
    return memoryRatings;
  } catch {
    return memoryRatings;
  }
}

function readRemoteRatings(): RemoteGameRatings {
  if (typeof window === "undefined") return memoryRemoteRatings;

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(GAME_REMOTE_RATING_STORAGE_KEY) || "{}",
    );
    memoryRemoteRatings = parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
    return memoryRemoteRatings;
  } catch {
    return memoryRemoteRatings;
  }
}

function readRemoteRatingFetchTimes(): RemoteRatingFetchTimes {
  if (typeof window === "undefined") return memoryRemoteRatingFetchTimes;

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(GAME_REMOTE_RATING_FETCHED_AT_STORAGE_KEY) || "{}",
    );
    memoryRemoteRatingFetchTimes = parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
    return memoryRemoteRatingFetchTimes;
  } catch {
    return memoryRemoteRatingFetchTimes;
  }
}

function normalizeStoredRating(value: unknown): StoredGameRating | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Partial<StoredGameRating>;
  const localVotes = normalizeVotes(Number(candidate.localVotes));
  const localScoreTotal = Number(candidate.localScoreTotal);
  const updatedAt = Number(candidate.updatedAt);

  if (!Number.isFinite(localScoreTotal) || localScoreTotal < 0) return null;

  return {
    localVotes,
    localScoreTotal: Math.min(localVotes * 5, localScoreTotal),
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0,
  };
}

function createSnapshot(
  gameId: string,
  seed: GameRatingSeed,
  storedRating: StoredGameRating | null,
): GameRatingSnapshot {
  const normalizedSeed = normalizeSeed(seed);
  const localVotes = storedRating?.localVotes ?? 0;
  const localScoreTotal = storedRating?.localScoreTotal ?? 0;
  const combinedVotes = normalizedSeed.votes + localVotes;
  const scoreTotal = (normalizedSeed.score * normalizedSeed.votes) + localScoreTotal;
  const calculatedRating = calculateRatingScores(scoreTotal, combinedVotes);

  return {
    gameId,
    score: calculatedRating.score,
    rawScore: calculatedRating.rawScore,
    votes: calculatedRating.votes,
    localVotes,
    localScoreTotal,
    updatedAt: storedRating?.updatedAt || null,
  };
}

export function getGameRatingSnapshot(
  gameId: string,
  seed: GameRatingSeed,
): GameRatingSnapshot {
  const remoteRating = readRemoteRatings()[gameId];
  if (remoteRating && normalizeVotes(remoteRating.votes) > 0) {
    const normalizedRemote = normalizeSeed(remoteRating);
    const calculatedRating = calculateRatingScores(
      normalizedRemote.score * normalizedRemote.votes,
      normalizedRemote.votes,
    );
    return {
      gameId,
      score: calculatedRating.score,
      rawScore: calculatedRating.rawScore,
      votes: calculatedRating.votes,
      localVotes: 0,
      localScoreTotal: 0,
      updatedAt: null,
    };
  }

  const storedRatings = readStoredRatings();
  return createSnapshot(
    gameId,
    seed,
    normalizeStoredRating(storedRatings[gameId]),
  );
}

export function syncRemoteCommentRating(
  gameId: string,
  rating: GameRatingSeed,
) {
  syncRemoteCommentRatings({ [gameId]: rating }, [gameId]);
  markRemoteGameRatingsFetched([gameId]);
}

export function syncRemoteCommentRatings(
  ratings: Record<string, GameRatingSeed>,
  requestedGameIds = Object.keys(ratings),
) {
  if (typeof window === "undefined") return;

  const remoteRatings = readRemoteRatings();
  const changedGameIds: string[] = [];

  requestedGameIds.forEach((gameId) => {
    const normalizedRating = normalizeSeed(ratings[gameId] || { score: 0, votes: 0 });
    const previousRating = remoteRatings[gameId];

    if (normalizedRating.votes === 0) {
      if (!previousRating) return;
      delete remoteRatings[gameId];
      changedGameIds.push(gameId);
      return;
    }

    if (
      previousRating?.score === normalizedRating.score &&
      previousRating.votes === normalizedRating.votes
    ) return;

    remoteRatings[gameId] = normalizedRating;
    changedGameIds.push(gameId);
  });

  if (changedGameIds.length === 0) return;

  memoryRemoteRatings = remoteRatings;
  try {
    window.localStorage.setItem(
      GAME_REMOTE_RATING_STORAGE_KEY,
      JSON.stringify(remoteRatings),
    );
  } catch {
    // The current page still receives the event when storage is blocked.
  }

  changedGameIds.forEach((gameId) => {
    window.dispatchEvent(
      new CustomEvent(GAME_RATING_CHANGED_EVENT, {
        detail: { gameId },
      }),
    );
  });
}

export function markRemoteGameRatingsFetched(
  gameIds: string[],
  fetchedAt = Date.now(),
) {
  if (typeof window === "undefined") return;
  const fetchTimes = readRemoteRatingFetchTimes();
  gameIds.forEach((gameId) => {
    fetchTimes[gameId] = fetchedAt;
  });
  memoryRemoteRatingFetchTimes = fetchTimes;
  try {
    window.localStorage.setItem(
      GAME_REMOTE_RATING_FETCHED_AT_STORAGE_KEY,
      JSON.stringify(fetchTimes),
    );
  } catch {
    // The current page still keeps the timestamps in memory.
  }
}

export function isRemoteGameRatingFresh(gameId: string, maximumAgeMs: number) {
  const fetchedAt = Number(readRemoteRatingFetchTimes()[gameId] || 0);
  return fetchedAt > 0 && Date.now() - fetchedAt < maximumAgeMs;
}

export function getSeedRatingSnapshot(
  gameId: string,
  seed: GameRatingSeed,
): GameRatingSnapshot {
  return createSnapshot(gameId, seed, null);
}

export function syncLocalCommentRatings(gameId: string, ratings: number[]) {
  if (typeof window === "undefined") return;

  const normalizedRatings = ratings
    .map(Number)
    .filter((rating) => Number.isFinite(rating) && rating >= 1 && rating <= 5);
  const localVotes = normalizedRatings.length;
  const localScoreTotal = normalizedRatings.reduce(
    (total, rating) => total + rating,
    0,
  );
  const storedRatings = readStoredRatings();
  const previousRating = normalizeStoredRating(storedRatings[gameId]);

  if (
    previousRating?.localVotes === localVotes &&
    previousRating.localScoreTotal === localScoreTotal
  ) {
    return;
  }

  if (localVotes === 0) {
    if (!previousRating) return;
    delete storedRatings[gameId];
  } else {
    storedRatings[gameId] = {
      localVotes,
      localScoreTotal,
      updatedAt: Date.now(),
    };
  }

  memoryRatings = storedRatings;

  try {
    window.localStorage.setItem(
      GAME_RATING_STORAGE_KEY,
      JSON.stringify(storedRatings),
    );
  } catch {
    // The current page still receives the event when browser storage is blocked.
  }

  window.dispatchEvent(
    new CustomEvent(GAME_RATING_CHANGED_EVENT, {
      detail: { gameId },
    }),
  );
}
