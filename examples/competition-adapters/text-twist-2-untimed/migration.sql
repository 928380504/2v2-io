CREATE TABLE IF NOT EXISTS word_score_events (
  event_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  game_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  player_nickname TEXT NOT NULL,
  mode_key TEXT NOT NULL,
  score INTEGER NOT NULL,
  rounds_completed INTEGER NOT NULL,
  words_found INTEGER NOT NULL,
  longest_word_length INTEGER NOT NULL,
  bingo_words_found INTEGER NOT NULL,
  occurred_at INTEGER NOT NULL,
  received_at INTEGER NOT NULL,
  day_key TEXT NOT NULL,
  country_code TEXT NOT NULL DEFAULT 'XX',
  client_game_version TEXT NOT NULL,
  client_profile_revision INTEGER NOT NULL,
  UNIQUE (profile_id, run_id)
);

CREATE INDEX IF NOT EXISTS idx_word_score_events_recent
  ON word_score_events (occurred_at DESC, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_word_score_events_profile
  ON word_score_events (profile_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS word_score_player_stats (
  period_key TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  nickname TEXT NOT NULL,
  country_code TEXT NOT NULL DEFAULT 'XX',
  runs INTEGER NOT NULL DEFAULT 0,
  best_score INTEGER NOT NULL DEFAULT 0,
  best_rounds INTEGER NOT NULL DEFAULT 0,
  best_words INTEGER NOT NULL DEFAULT 0,
  best_longest_word INTEGER NOT NULL DEFAULT 0,
  best_bingo_words INTEGER NOT NULL DEFAULT 0,
  best_achieved_at INTEGER NOT NULL DEFAULT 0,
  best_sort_key TEXT NOT NULL,
  last_played_at INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (period_key, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_word_score_stats_ranking
  ON word_score_player_stats (
    period_key,
    best_score DESC,
    best_rounds DESC,
    best_words DESC,
    best_bingo_words DESC,
    best_longest_word DESC,
    best_achieved_at ASC,
    profile_id ASC
  );

CREATE TABLE IF NOT EXISTS word_score_live_refresh_limits (
  period_key TEXT NOT NULL,
  window_day TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  refresh_count INTEGER NOT NULL DEFAULT 0,
  last_refreshed_at INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (period_key, window_day, profile_id)
);

