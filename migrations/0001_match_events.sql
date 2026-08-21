CREATE TABLE IF NOT EXISTS match_events (
  event_id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL CHECK (schema_version = 3),
  game_id TEXT NOT NULL CHECK (game_id = '1v1-lol'),
  profile_id TEXT NOT NULL,
  player_network_user_id TEXT,
  player_nickname TEXT NOT NULL,
  opponent_network_user_id TEXT,
  opponent_nickname TEXT,
  opponent_actor_id INTEGER,
  mode_key TEXT NOT NULL CHECK (mode_key = '1v1'),
  result TEXT NOT NULL CHECK (result IN ('win', 'loss')),
  kills INTEGER NOT NULL CHECK (kills >= 0 AND kills <= 100),
  deaths INTEGER NOT NULL CHECK (deaths >= 0 AND deaths <= 100),
  is_competitive INTEGER NOT NULL CHECK (is_competitive IN (0, 1)),
  rank_type INTEGER,
  occurred_at INTEGER NOT NULL,
  received_at INTEGER NOT NULL,
  day_key TEXT NOT NULL,
  country_code TEXT NOT NULL DEFAULT 'XX',
  client_game_version TEXT NOT NULL,
  client_profile_revision INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS match_events_day_rank_idx
  ON match_events (day_key, mode_key, result, received_at DESC);

CREATE INDEX IF NOT EXISTS match_events_profile_day_idx
  ON match_events (profile_id, day_key, received_at DESC);

CREATE INDEX IF NOT EXISTS match_events_ticker_idx
  ON match_events (day_key, result, received_at DESC)
  WHERE opponent_nickname IS NOT NULL;
