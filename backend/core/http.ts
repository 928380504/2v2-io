import {
  isValidSiteDay,
  nextSiteDayReset,
  siteDayKey
} from "../../lib/site-time";

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const BASE_HEADERS: Record<string, string> = {
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin"
};

export function json(
  value: unknown,
  status = 200,
  headers: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      ...BASE_HEADERS,
      ...headers
    }
  });
}

export function noStoreJson(value: unknown, status = 200): Response {
  return json(value, status, { "Cache-Control": "no-store" });
}

export function cachedJson(
  value: unknown,
  maxAgeSeconds = 15,
  staleWhileRevalidateSeconds = 30
): Response {
  return json(value, 200, {
    "Cache-Control": `public, max-age=${maxAgeSeconds}, s-maxage=${maxAgeSeconds}, stale-while-revalidate=${staleWhileRevalidateSeconds}`
  });
}

type EdgeCacheStorage = CacheStorage & { default?: Cache };

function defaultEdgeCache(): Cache | null {
  if (typeof caches === "undefined") return null;
  return (caches as EdgeCacheStorage).default || null;
}

export function sharedGetCacheKey(
  request: Request,
  parameters: Record<string, string | number | null | undefined>
): Request {
  const url = new URL(request.url);
  url.hash = "";
  url.search = "";
  Object.entries(parameters).forEach(([name, value]) => {
    if (value === null || value === undefined) return;
    url.searchParams.set(name, String(value));
  });
  return new Request(url.toString(), { method: "GET" });
}

export async function matchSharedGetCache(
  cacheKey: Request
): Promise<Response | null> {
  const cache = defaultEdgeCache();
  if (!cache) return null;
  try {
    return (await cache.match(cacheKey)) || null;
  } catch (error) {
    console.error("Shared edge cache read failed", error);
    return null;
  }
}

export function scheduleSharedGetCache(
  cacheKey: Request,
  response: Response,
  waitUntil: (promise: Promise<unknown>) => void
): void {
  const cache = defaultEdgeCache();
  if (!cache || !response.ok) return;
  waitUntil(
    cache.put(cacheKey, response.clone()).catch((error) => {
      console.error("Shared edge cache write failed", error);
    })
  );
}

export function optionsResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "Allow": "GET, POST, OPTIONS",
      "Cache-Control": "public, max-age=86400"
    }
  });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return noStoreJson({
      ok: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details })
      }
    }, error.status);
  }

  console.error("Unhandled Pages Function error", error);
  return noStoreJson({
    ok: false,
    error: {
      code: "internal_error",
      message: "The request could not be completed."
    }
  }, 500);
}

export async function readJsonBody(
  request: Request,
  maximumBytes = 128 * 1024
): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new ApiError(413, "payload_too_large", "The request body is too large.");
  }

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new ApiError(415, "unsupported_media_type", "Expected application/json.");
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    throw new ApiError(400, "invalid_body", "The request body could not be read.");
  }
  if (new TextEncoder().encode(text).byteLength > maximumBytes) {
    throw new ApiError(413, "payload_too_large", "The request body is too large.");
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(400, "invalid_json", "The request body is not valid JSON.");
  }
}

export { nextSiteDayReset, siteDayKey };

export function parseDay(value: string | null, now = Date.now()): string {
  if (!value) return siteDayKey(now);
  if (!isValidSiteDay(value)) {
    throw new ApiError(400, "invalid_day", "day is not a valid calendar date.");
  }
  return value;
}

export function parseIntegerQuery(
  value: string | null,
  fallback: number,
  minimum: number,
  maximum: number,
  name: string
): number {
  if (value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new ApiError(
      400,
      `invalid_${name}`,
      `${name} must be an integer from ${minimum} to ${maximum}.`
    );
  }
  return parsed;
}
