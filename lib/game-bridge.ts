import { SITE_RUNTIME } from "@/site/runtime";

export const GAME_BRIDGE_SOURCE = SITE_RUNTIME.bridge.gameSource;
export const SITE_BRIDGE_SOURCE = SITE_RUNTIME.bridge.siteSource;
export const GAME_BRIDGE_SCHEMA_VERSION = 1;
export const SITE_PROFILE_CACHE_KEY = SITE_RUNTIME.storage.profile;
export const PROFILE_READY_EVENT = SITE_RUNTIME.events.profileReady;
export const MATCHES_UPLOADED_EVENT = SITE_RUNTIME.events.matchesUploaded;

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface GameProfileSummary {
  profileId: string;
  nickname: string;
  revision: number;
}

export interface CachedGameProfile extends GameProfileSummary {
  receivedAt: number;
}

export interface ProfileReadyMessage {
  source: typeof GAME_BRIDGE_SOURCE;
  schemaVersion: typeof GAME_BRIDGE_SCHEMA_VERSION;
  type: "profile.ready";
  profile: GameProfileSummary;
}

export interface PendingMatchesMessage {
  source: typeof GAME_BRIDGE_SOURCE;
  schemaVersion: typeof GAME_BRIDGE_SCHEMA_VERSION;
  type: "matches.pending";
  profileId: string;
  events: Array<Record<string, unknown>>;
}

export type GameBridgeMessage = ProfileReadyMessage | PendingMatchesMessage;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isProfileId(value: unknown): value is string {
  return typeof value === "string" && UUID_V4.test(value);
}

function isEventRecord(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && isProfileId(value.eventId);
}

export function parseGameBridgeMessage(value: unknown): GameBridgeMessage | null {
  if (
    !isRecord(value) ||
    value.source !== GAME_BRIDGE_SOURCE ||
    value.schemaVersion !== GAME_BRIDGE_SCHEMA_VERSION
  ) {
    return null;
  }

  if (value.type === "profile.ready" && isRecord(value.profile)) {
    const profile = value.profile;
    if (
      !isProfileId(profile.profileId) ||
      typeof profile.nickname !== "string" ||
      !profile.nickname.trim() ||
      profile.nickname.length > 64 ||
      typeof profile.revision !== "number" ||
      !Number.isSafeInteger(profile.revision) ||
      profile.revision < 0
    ) {
      return null;
    }

    return {
      source: GAME_BRIDGE_SOURCE,
      schemaVersion: GAME_BRIDGE_SCHEMA_VERSION,
      type: "profile.ready",
      profile: {
        profileId: profile.profileId.toLowerCase(),
        nickname: profile.nickname.trim(),
        revision: profile.revision,
      },
    };
  }

  if (
    value.type === "matches.pending" &&
    isProfileId(value.profileId) &&
    Array.isArray(value.events) &&
    value.events.length > 0 &&
    value.events.length <= 20 &&
    value.events.every(isEventRecord)
  ) {
    return {
      source: GAME_BRIDGE_SOURCE,
      schemaVersion: GAME_BRIDGE_SCHEMA_VERSION,
      type: "matches.pending",
      profileId: value.profileId.toLowerCase(),
      events: value.events,
    };
  }

  return null;
}

export function createBridgeRequestMessage() {
  return {
    source: SITE_BRIDGE_SOURCE,
    schemaVersion: GAME_BRIDGE_SCHEMA_VERSION,
    type: "bridge.request",
  } as const;
}

export function createMatchAcknowledgementMessage(
  profileId: string,
  acknowledgedEventIds: string[],
) {
  return {
    source: SITE_BRIDGE_SOURCE,
    schemaVersion: GAME_BRIDGE_SCHEMA_VERSION,
    type: "matches.ack",
    profileId,
    acknowledgedEventIds,
  } as const;
}

export function readCachedGameProfile(): CachedGameProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(
      window.localStorage.getItem(SITE_PROFILE_CACHE_KEY) || "null",
    ) as unknown;
    if (!isRecord(value)) return null;
    const parsed = parseGameBridgeMessage({
      source: GAME_BRIDGE_SOURCE,
      schemaVersion: GAME_BRIDGE_SCHEMA_VERSION,
      type: "profile.ready",
      profile: value,
    });
    if (
      !parsed ||
      parsed.type !== "profile.ready" ||
      typeof value.receivedAt !== "number" ||
      !Number.isFinite(value.receivedAt)
    ) {
      return null;
    }
    return {
      ...parsed.profile,
      receivedAt: value.receivedAt,
    };
  } catch {
    return null;
  }
}
