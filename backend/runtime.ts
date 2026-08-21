import { siteBackendConfig } from "../site/backend";
import type { CompetitionAdapter, CompetitionAdapterId } from "./contracts";
import { oneVOneLolAdapter } from "./adapters/1v1-lol";
import { wordScoreAdapter } from "./adapters/word-score";

const competitionAdapters: Record<CompetitionAdapterId, CompetitionAdapter> = {
  "1v1-lol": oneVOneLolAdapter,
  "word-score": wordScoreAdapter
};

export const competitionAdapter =
  competitionAdapters[siteBackendConfig.competitionAdapterId];
