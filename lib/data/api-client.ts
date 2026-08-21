import { DATA_PROVIDER } from "@/config/data-provider";

export interface DataApiResult<T> {
  ok: boolean;
  status: number;
  data: T;
}

export class DataApiError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "DataApiError";
    this.status = status;
    this.payload = payload;
  }
}

function resolveApiPath(path: string) {
  const base = DATA_PROVIDER.apiBasePath.replace(/\/$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}` || suffix;
}

function errorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;
  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== "object") return fallback;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && message.trim() ? message : fallback;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export async function requestDataResult<T>(
  path: string,
  init: RequestInit = {},
): Promise<DataApiResult<T>> {
  const headers = new Headers(init.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  const response = await fetch(resolveApiPath(path), {
    credentials: "same-origin",
    ...init,
    headers,
  });
  return {
    ok: response.ok,
    status: response.status,
    data: (await readJson(response)) as T,
  };
}

export async function requestData<T>(
  path: string,
  init: RequestInit = {},
  fallbackError = "The data request could not be completed.",
): Promise<T> {
  const result = await requestDataResult<T>(path, init);
  if (!result.ok) {
    throw new DataApiError(
      errorMessage(result.data, fallbackError),
      result.status,
      result.data,
    );
  }
  return result.data;
}

export function dataQuery(
  path: string,
  values: Record<string, string | number | null | undefined>,
) {
  const search = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  });
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}
