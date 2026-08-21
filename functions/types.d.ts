interface D1Meta {
  changes?: number;
  duration?: number;
  rows_read?: number;
  rows_written?: number;
}

interface D1Result<T = Record<string, unknown>> {
  success: boolean;
  results?: T[];
  meta: D1Meta;
  error?: string;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  first<T = Record<string, unknown>>(column?: string): Promise<T | null>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = Record<string, unknown>>(
    statements: D1PreparedStatement[]
  ): Promise<D1Result<T>[]>;
}

interface PagesEnv {
  DB?: D1Database;
  [bindingName: string]: D1Database | undefined;
}

interface PagesFunctionContext<Env = PagesEnv> {
  request: Request;
  env: Env;
  params: Record<string, string | string[]>;
  data: Record<string, unknown>;
  waitUntil(promise: Promise<unknown>): void;
  next(input?: Request | string, init?: RequestInit): Promise<Response>;
}

type PagesFunction<Env = PagesEnv> = (
  context: PagesFunctionContext<Env>
) => Response | Promise<Response>;
