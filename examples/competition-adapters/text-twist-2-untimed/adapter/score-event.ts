import { ApiError } from "../../core/http";

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/g;
const MAX_PAST_AGE_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

export interface NormalizedScoreEvent {
  eventId: string;
  runId: string;
  profileId: string;
  playerNickname: string;
  score: number;
  roundsCompleted: number;
  wordsFound: number;
  longestWordLength: number;
  bingoWordsFound: number;
  occurredAt: number;
  gameVersion: string;
  profileRevision: number;
}

function objectValue(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(400, "invalid_event", `${path} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, path: string, maximum: number) {
  if (typeof value !== "string") {
    throw new ApiError(400, "invalid_event", `${path} must be a string.`);
  }
  const normalized = value.replace(CONTROL_CHARACTERS, "").trim();
  if (!normalized || normalized.length > maximum) {
    throw new ApiError(
      400,
      "invalid_event",
      `${path} must contain 1-${maximum} visible characters.`,
    );
  }
  return normalized;
}

function uuid(value: unknown, path: string) {
  const normalized = requiredString(value, path, 64);
  if (!UUID_V4.test(normalized)) {
    throw new ApiError(400, "invalid_event", `${path} must be a UUID v4.`);
  }
  return normalized.toLowerCase();
}

function integer(
  value: unknown,
  path: string,
  minimum: number,
  maximum: number,
) {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new ApiError(
      400,
      "invalid_event",
      `${path} must be an integer from ${minimum} to ${maximum}.`,
    );
  }
  return value;
}

export function normalizeScoreEvent(
  value: unknown,
  now = Date.now(),
): NormalizedScoreEvent {
  const event = objectValue(value, "event");
  const player = objectValue(event.player, "event.player");
  const score = objectValue(event.score, "event.score");
  const client = objectValue(event.client, "event.client");

  if (event.schemaVersion !== 1) {
    throw new ApiError(400, "unsupported_schema", "Only schemaVersion 1 is accepted.");
  }
  if (
    event.eventType !== "score.completed" ||
    event.gameId !== "text-twist-2-untimed"
  ) {
    throw new ApiError(400, "invalid_event", "Unsupported eventType or gameId.");
  }
  if (score.modeKey !== "untimed") {
    throw new ApiError(400, "unsupported_mode", "Only Untimed score events are accepted.");
  }

  const profileId = uuid(event.profileId, "event.profileId");
  if (profileId !== uuid(player.profileId, "event.player.profileId")) {
    throw new ApiError(
      400,
      "profile_mismatch",
      "event.profileId must match event.player.profileId.",
    );
  }

  const occurredAt = integer(
    event.occurredAt,
    "event.occurredAt",
    0,
    Number.MAX_SAFE_INTEGER,
  );
  if (occurredAt < now - MAX_PAST_AGE_MS || occurredAt > now + MAX_FUTURE_SKEW_MS) {
    throw new ApiError(
      400,
      "invalid_event_time",
      "event.occurredAt is outside the accepted time window.",
    );
  }

  return {
    eventId: uuid(event.eventId, "event.eventId"),
    runId: uuid(event.runId, "event.runId"),
    profileId,
    playerNickname: requiredString(player.nickname, "event.player.nickname", 64),
    score: integer(score.value, "event.score.value", 0, 999_999_999),
    roundsCompleted: integer(
      score.roundsCompleted,
      "event.score.roundsCompleted",
      0,
      99_999,
    ),
    wordsFound: integer(score.wordsFound, "event.score.wordsFound", 0, 999_999),
    longestWordLength: integer(
      score.longestWordLength,
      "event.score.longestWordLength",
      0,
      64,
    ),
    bingoWordsFound: integer(
      score.bingoWordsFound,
      "event.score.bingoWordsFound",
      0,
      99_999,
    ),
    occurredAt,
    gameVersion: requiredString(client.gameVersion, "event.client.gameVersion", 32),
    profileRevision: integer(
      client.profileRevision,
      "event.client.profileRevision",
      0,
      Number.MAX_SAFE_INTEGER,
    ),
  };
}

export function normalizeScoreBatch(
  value: unknown,
  now = Date.now(),
): NormalizedScoreEvent[] {
  const body = objectValue(value, "body");
  if (!Array.isArray(body.events) || body.events.length < 1 || body.events.length > 20) {
    throw new ApiError(
      400,
      "invalid_batch",
      "body.events must contain between 1 and 20 events.",
    );
  }

  const events = body.events.map((event, eventIndex) => {
    try {
      return normalizeScoreEvent(event, now);
    } catch (error) {
      if (error instanceof ApiError) {
        throw new ApiError(error.status, error.code, error.message, { eventIndex });
      }
      throw error;
    }
  });

  const eventIds = new Set<string>();
  const runIds = new Set<string>();
  for (const event of events) {
    if (eventIds.has(event.eventId) || runIds.has(`${event.profileId}:${event.runId}`)) {
      throw new ApiError(
        400,
        "duplicate_event",
        "The request repeats an eventId or profile runId.",
      );
    }
    eventIds.add(event.eventId);
    runIds.add(`${event.profileId}:${event.runId}`);
  }
  return events;
}
