import { SITE_RUNTIME } from "@/site/runtime";

const SITE_VISITOR_STORAGE_KEY = SITE_RUNTIME.storage.visitor;

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let memoryVisitorId: string | null = null;

export function isSiteVisitorId(value: unknown): value is string {
  return typeof value === "string" && UUID_V4.test(value);
}

export function getSiteVisitorId(): string {
  if (typeof window === "undefined") return "";

  try {
    const storedVisitorId = window.localStorage.getItem(
      SITE_VISITOR_STORAGE_KEY,
    );
    if (isSiteVisitorId(storedVisitorId)) {
      memoryVisitorId = storedVisitorId.toLowerCase();
      return memoryVisitorId;
    }
  } catch {
    // Fall back to a session-only identity when localStorage is unavailable.
  }

  if (!memoryVisitorId) memoryVisitorId = window.crypto.randomUUID();

  try {
    window.localStorage.setItem(SITE_VISITOR_STORAGE_KEY, memoryVisitorId);
  } catch {
    // The in-memory identity remains usable for the current page session.
  }

  return memoryVisitorId;
}

