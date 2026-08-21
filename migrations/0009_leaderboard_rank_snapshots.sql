CREATE TABLE IF NOT EXISTS leaderboard_snapshot_state (
  period_key TEXT PRIMARY KEY,
  active_snapshot_id TEXT,
  generated_at INTEGER NOT NULL DEFAULT 0,
  total_players INTEGER NOT NULL DEFAULT 0 CHECK (total_players >= 0),
  refresh_lock_until INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS leaderboard_rank_snapshots (
  snapshot_id TEXT NOT NULL,
  period_key TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  rank INTEGER NOT NULL CHECK (rank > 0),
  nickname TEXT NOT NULL,
  country_code TEXT NOT NULL DEFAULT 'XX',
  games INTEGER NOT NULL DEFAULT 0 CHECK (games >= 0),
  wins INTEGER NOT NULL DEFAULT 0 CHECK (wins >= 0),
  losses INTEGER NOT NULL DEFAULT 0 CHECK (losses >= 0),
  kills INTEGER NOT NULL DEFAULT 0 CHECK (kills >= 0),
  deaths INTEGER NOT NULL DEFAULT 0 CHECK (deaths >= 0),
  win_rate_tenths INTEGER NOT NULL DEFAULT 0 CHECK (win_rate_tenths >= 0),
  best_win_streak INTEGER NOT NULL DEFAULT 0 CHECK (best_win_streak >= 0),
  last_played_at INTEGER NOT NULL DEFAULT 0,
  previous_day_rank INTEGER,
  gold_medals INTEGER NOT NULL DEFAULT 0 CHECK (gold_medals >= 0),
  silver_medals INTEGER NOT NULL DEFAULT 0 CHECK (silver_medals >= 0),
  bronze_medals INTEGER NOT NULL DEFAULT 0 CHECK (bronze_medals >= 0),
  total_medals INTEGER NOT NULL DEFAULT 0 CHECK (total_medals >= 0),
  PRIMARY KEY (snapshot_id, profile_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS leaderboard_rank_snapshots_rank_idx
  ON leaderboard_rank_snapshots (snapshot_id, rank);

CREATE INDEX IF NOT EXISTS leaderboard_rank_snapshots_period_idx
  ON leaderboard_rank_snapshots (period_key, snapshot_id);

CREATE TABLE IF NOT EXISTS leaderboard_live_refresh_limits (
  window_day TEXT NOT NULL,
  period_key TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  last_refreshed_at INTEGER NOT NULL,
  refresh_count INTEGER NOT NULL DEFAULT 1 CHECK (refresh_count >= 0),
  PRIMARY KEY (window_day, period_key, profile_id)
);

CREATE INDEX IF NOT EXISTS leaderboard_live_refresh_limits_cleanup_idx
  ON leaderboard_live_refresh_limits (window_day);
