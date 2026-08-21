import type { SiteBackendConfig } from "../backend/contracts";

export const siteBackendConfig = {
  databaseBinding: "DB",
  competitionAdapterId: "1v1-lol"
} as const satisfies SiteBackendConfig;
