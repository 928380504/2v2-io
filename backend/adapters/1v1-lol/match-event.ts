import { ApiError } from "../../core/http";

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NETWORK_ID = /^[A-Za-z0-9._:-]{1,128}$/;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/g;
const MAX_PAST_AGE_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

export interface NormalizedMatchEvent {
  eventId: string;
  profileId: string;
  playerNetworkUserId: string | null;
  playerNickname: string;
  opponentNetworkUserId: string | null;
  opponentNickname: string | null;
  opponentActorId: number | null;
  modeKey: "1v1";
  result: "win" | "loss";
  kills: number;
  deaths: number;
  isCompetitive: boolean;
  rankType: number | null;
  occurredAt: number;
  gameVersion: string;
  profileRevision: number;
}

function objectValue(
  value: unknown,
  path: string
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(400, "invalid_event", `${path} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requiredString(
  value: unknown,
  path: string,
  maximumLength: number
): string {
  if (typeof value !== "string") {
    throw new ApiError(400, "invalid_event", `${path} must be a string.`);
  }
  const normalized = value.replace(CONTROL_CHARACTERS, "").trim();
  if (!normalized || normalized.length > maximumLength) {
    throw new ApiError(
      400,
      "invalid_event",
      `${path} must contain 1-${maximumLength} visible characters.`
    );
  }
  return normalized;
}

function optionalString(
  value: unknown,
  path: string,
  maximumLength: number
): string | null {
  if (value === null || value === undefined || value === "") return null;
  return requiredString(value, path, maximumLength);
}

function boundedInteger(
  value: unknown,
  path: string,
  minimum: number,
  maximum: number
): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new ApiError(
      400,
      "invalid_event",
      `${path} must be an integer from ${minimum} to ${maximum}.`
    );
  }
  return value;
}

function nullableInteger(
  value: unknown,
  path: string,
  minimum: number,
  maximum: number
): number | null {
  if (value === null || value === undefined) return null;
  return boundedInteger(value, path, minimum, maximum);
}

function validateUuid(value: unknown, path: string): string {
  const normalized = requiredString(value, path, 64);
  if (!UUID_V4.test(normalized)) {
    throw new ApiError(400, "invalid_event", `${path} must be a UUID v4.`);
  }
  return normalized.toLowerCase();
}

function validateNetworkId(value: unknown, path: string): string | null {
  const normalized = optionalString(value, path, 128);
  if (normalized && !NETWORK_ID.test(normalized)) {
    throw new ApiError(
      400,
      "invalid_event",
      `${path} contains unsupported characters.`
    );
  }
  return normalized;
}

export function normalizeMatchEvent(
  value: unknown,
  now = Date.now()
): NormalizedMatchEvent {
  const event = objectValue(value, "event");
  const player = objectValue(event.player, "event.player");
  const match = objectValue(event.match, "event.match");
  const opponent = objectValue(event.opponent, "event.opponent");
  const client = objectValue(event.client, "event.client");

  if (event.schemaVersion !== 3) {
    throw new ApiError(400, "unsupported_schema", "Only schemaVersion 3 is accepted.");
  }
  if (event.eventType !== "match.completed" || event.gameId !== "1v1-lol") {
    throw new ApiError(400, "invalid_event", "Unsupported eventType or gameId.");
  }

  const profileId = validateUuid(event.profileId, "event.profileId");
  const nestedProfileId = validateUuid(
    player.profileId,
    "event.player.profileId"
  );
  if (profileId !== nestedProfileId) {
    throw new ApiError(
      400,
      "profile_mismatch",
      "event.profileId must match event.player.profileId."
    );
  }

  const occurredAt = boundedInteger(
    event.occurredAt,
    "event.occurredAt",
    0,
    Number.MAX_SAFE_INTEGER
  );
  if (occurredAt < now - MAX_PAST_AGE_MS || occurredAt > now + MAX_FUTURE_SKEW_MS) {
    throw new ApiError(
      400,
      "invalid_event_time",
      "event.occurredAt is outside the accepted time window."
    );
  }

  const modeKey = requiredString(match.modeKey, "event.match.modeKey", 32);
  if (modeKey !== "1v1" || match.mode !== "1v1") {
    throw new ApiError(400, "unsupported_mode", "Only normal 1v1 events are accepted.");
  }
  if (match.result !== "win" && match.result !== "loss") {
    throw new ApiError(400, "invalid_event", "event.match.result must be win or loss.");
  }
  if (typeof match.isCompetitive !== "boolean") {
    throw new ApiError(
      400,
      "invalid_event",
      "event.match.isCompetitive must be a boolean."
    );
  }

  return {
    eventId: validateUuid(event.eventId, "event.eventId"),
    profileId,
    playerNetworkUserId: validateNetworkId(
      player.networkUserId,
      "event.player.networkUserId"
    ),
    playerNickname: requiredString(
      player.nickname,
      "event.player.nickname",
      64
    ),
    opponentNetworkUserId: validateNetworkId(
      opponent.networkUserId,
      "event.opponent.networkUserId"
    ),
    opponentNickname: optionalString(
      opponent.nickname,
      "event.opponent.nickname",
      64
    ),
    opponentActorId: nullableInteger(
      opponent.actorId,
      "event.opponent.actorId",
      1,
      1_000_000
    ),
    modeKey: "1v1",
    result: match.result,
    kills: boundedInteger(match.kills, "event.match.kills", 0, 100),
    deaths: boundedInteger(match.deaths, "event.match.deaths", 0, 100),
    isCompetitive: match.isCompetitive,
    rankType: nullableInteger(match.rankType, "event.match.rankType", -1000, 1000),
    occurredAt,
    gameVersion: requiredString(
      client.gameVersion,
      "event.client.gameVersion",
      32
    ),
    profileRevision: boundedInteger(
      client.profileRevision,
      "event.client.profileRevision",
      0,
      Number.MAX_SAFE_INTEGER
    )
  };
}

export function normalizeEventBatch(
  value: unknown,
  now = Date.now()
): NormalizedMatchEvent[] {
  const body = objectValue(value, "body");
  if (!Array.isArray(body.events)) {
    throw new ApiError(400, "invalid_batch", "body.events must be an array.");
  }
  if (!body.events.length || body.events.length > 20) {
    throw new ApiError(
      400,
      "invalid_batch",
      "body.events must contain between 1 and 20 events."
    );
  }

  const normalized = body.events.map((event, index) => {
    try {
      return normalizeMatchEvent(event, now);
    } catch (error) {
      if (error instanceof ApiError) {
        throw new ApiError(
          error.status,
          error.code,
          error.message,
          { eventIndex: index }
        );
      }
      throw error;
    }
  });

  const ids = new Set<string>();
  for (const event of normalized) {
    if (ids.has(event.eventId)) {
      throw new ApiError(
        400,
        "duplicate_event_id",
        "The request contains the same eventId more than once."
      );
    }
    ids.add(event.eventId);
  }
  return normalized;
}
