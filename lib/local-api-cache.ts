export interface LocalApiCacheEnvelope<T> {
  version: 1;
  savedAt: number;
  value: T;
}

export function readLocalApiCacheEntry<T>(
  key: string,
  validate: (value: unknown) => value is T,
): LocalApiCacheEnvelope<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || "null") as
      | LocalApiCacheEnvelope<unknown>
      | null;
    if (
      !parsed ||
      parsed.version !== 1 ||
      typeof parsed.savedAt !== "number" ||
      !Number.isFinite(parsed.savedAt) ||
      !validate(parsed.value)
    ) {
      return null;
    }
    return parsed as LocalApiCacheEnvelope<T>;
  } catch {
    return null;
  }
}

export function readLocalApiCache<T>(
  key: string,
  validate: (value: unknown) => value is T,
): T | null {
  return readLocalApiCacheEntry(key, validate)?.value ?? null;
}

export function writeLocalApiCache<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    const envelope: LocalApiCacheEnvelope<T> = {
      version: 1,
      savedAt: Date.now(),
      value,
    };
    window.localStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    // Live in-memory data remains usable when localStorage is unavailable.
  }
}
