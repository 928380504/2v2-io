export type CompetitionAdapterId = "1v1-lol" | "word-score";

export interface SiteBackendConfig {
  databaseBinding: string;
  competitionAdapterId: CompetitionAdapterId;
}

export interface ReadEndpoint {
  options: PagesFunction;
  get: PagesFunction;
}

export interface WriteEndpoint {
  options: PagesFunction;
  post: PagesFunction;
}

export interface CompetitionAdapter {
  id: CompetitionAdapterId;
  gameId: string;
  modeKey: string;
  eventSchemaVersion: number;
  migrationGroup: string;
  handlers: {
    ticker: ReadEndpoint;
    profile: ReadEndpoint;
    leaderboardDaily: ReadEndpoint;
    leaderboardAllTime: ReadEndpoint;
    leaderboardContext: ReadEndpoint;
    leaderboardLive: ReadEndpoint;
    matchesBatch: WriteEndpoint;
  };
}
