import { ApiError } from "./http";
import { siteBackendConfig } from "../../site/backend";

export function requireDatabase(env: PagesEnv): D1Database {
  const bindingName = siteBackendConfig.databaseBinding;
  const database = env[bindingName];
  if (!database) {
    throw new ApiError(
      503,
      "database_unavailable",
      `The D1 binding named ${bindingName} is not configured.`
    );
  }
  return database;
}

export function countryCodeFromRequest(request: Request): string {
  const country = (request as Request & {
    cf?: { country?: unknown };
  }).cf?.country;
  return typeof country === "string" && /^[A-Z]{2}$/.test(country)
    ? country
    : "XX";
}
