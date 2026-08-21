CREATE TABLE IF NOT EXISTS feed_events (
  feed_event_id TEXT PRIMARY KEY,
  source_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('live', 'streak', 'arena')),
  day_key TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  player_nickname TEXT NOT NULL,
  opponent_nickname TEXT,
  mode_label TEXT,
  tier_key TEXT NOT NULL CHECK (
    tier_key IN ('live', 'silver', 'green', 'blue', 'purple', 'gold')
  ),
  achievement_key TEXT,
  achievement_label TEXT,
  achievement_value INTEGER,
  country_code TEXT NOT NULL DEFAULT 'XX',
  occurred_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  priority INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS feed_events_day_idx
  ON feed_events (day_key, created_at DESC, priority DESC);

CREATE INDEX IF NOT EXISTS feed_events_recent_idx
  ON feed_events (
    occurred_at DESC,
    created_at DESC,
    priority DESC,
    feed_event_id DESC
  );

CREATE TABLE IF NOT EXISTS daily_player_milestones (
  day_key TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  milestone_type TEXT NOT NULL CHECK (
    milestone_type IN ('streak', 'arena')
  ),
  tier_level INTEGER NOT NULL,
  milestone_value INTEGER NOT NULL,
  source_event_id TEXT NOT NULL,
  achieved_at INTEGER NOT NULL,
  PRIMARY KEY (day_key, profile_id, milestone_type, tier_level)
);

CREATE INDEX IF NOT EXISTS daily_player_milestones_profile_idx
  ON daily_player_milestones (
    day_key,
    profile_id,
    milestone_type,
    tier_level DESC
  );

INSERT OR IGNORE INTO feed_events (
  feed_event_id,
  source_event_id,
  event_type,
  day_key,
  profile_id,
  player_nickname,
  opponent_nickname,
  mode_label,
  tier_key,
  achievement_key,
  achievement_label,
  achievement_value,
  country_code,
  occurred_at,
  created_at,
  priority
)
SELECT
  'live:' || event_id,
  event_id,
  'live',
  day_key,
  profile_id,
  player_nickname,
  opponent_nickname,
  CASE
    WHEN is_competitive = 1 THEN '1v1 Competitive'
    ELSE '1v1 Casual'
  END,
  'live',
  NULL,
  NULL,
  NULL,
  country_code,
  occurred_at,
  received_at,
  1
FROM match_events
WHERE
  mode_key = '1v1'
  AND result = 'win'
  AND opponent_nickname IS NOT NULL
  AND opponent_nickname <> '';
