import { requireDatabase } from "../core/database";
import { errorResponse, noStoreJson, optionsResponse } from "../core/http";
import { siteBackendConfig } from "../../site/backend";

export const onRequestOptions: PagesFunction = async () => optionsResponse();

/** Lightweight binding probe. Functional schema checks remain client-side. */
export const onRequestGet: PagesFunction = async (context) => {
  try {
    const database = requireDatabase(context.env);
    const row = await database.prepare("SELECT 1 AS ready").first<{ ready: number }>();
    return noStoreJson({
      ok: row?.ready === 1,
      database: row?.ready === 1 ? "ready" : "unavailable",
      competitionAdapter: siteBackendConfig.competitionAdapterId,
    });
  } catch (error) {
    return errorResponse(error);
  }
};
