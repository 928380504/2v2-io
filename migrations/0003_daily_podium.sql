CREATE TABLE IF NOT EXISTS daily_podium (
  day_key TEXT NOT NULL,
  mode_key TEXT NOT NULL DEFAULT '1v1' CHECK (mode_key = '1v1'),
  rank INTEGER NOT NULL CHECK (rank BETWEEN 1 AND 3),
  profile_id TEXT NOT NULL,
  nickname_at_award TEXT NOT NULL,
  country_code TEXT NOT NULL DEFAULT 'XX',
  wins INTEGER NOT NULL CHECK (wins >= 0),
  awarded_at INTEGER NOT NULL,
  PRIMARY KEY (day_key, mode_key, rank),
  UNIQUE (day_key, mode_key, profile_id)
);

CREATE INDEX IF NOT EXISTS daily_podium_profile_idx
  ON daily_podium (profile_id, mode_key, rank, day_key DESC);

CREATE TABLE IF NOT EXISTS daily_podium_days (
  day_key TEXT NOT NULL,
  mode_key TEXT NOT NULL DEFAULT '1v1' CHECK (mode_key = '1v1'),
  participant_count INTEGER NOT NULL CHECK (participant_count >= 0),
  finalized_at INTEGER NOT NULL,
  PRIMARY KEY (day_key, mode_key)
);

-- Legacy one-time backfill for completed stored day keys. Runtime podium
-- finalization uses the configurable site time zone in lib/site-time.ts.
WITH
eligible_matches AS (
  SELECT *
  FROM match_events
  WHERE
    mode_key = '1v1'
    AND day_key < CASE
      WHEN time('now') >= '00:15:00' THEN date('now')
      ELSE date('now', '-1 day')
    END
),
latest_identity AS (
  SELECT
    day_key,
    profile_id,
    player_nickname,
    country_code,
    ROW_NUMBER() OVER (
      PARTITION BY day_key, profile_id
      ORDER BY received_at DESC, event_id DESC
    ) AS identity_row
  FROM eligible_matches
),
aggregates AS (
  SELECT
    day_key,
    profile_id,
    COUNT(*) AS games,
    SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) AS wins,
    SUM(kills) AS kills,
    ROUND(
      100.0 * SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) / COUNT(*),
      1
    ) AS win_rate,
    MAX(received_at) AS last_played_at
  FROM eligible_matches
  GROUP BY day_key, profile_id
),
ranked AS (
  SELECT
    aggregates.day_key,
    aggregates.profile_id,
    latest_identity.player_nickname,
    latest_identity.country_code,
    aggregates.wins,
    ROW_NUMBER() OVER (
      PARTITION BY aggregates.day_key
      ORDER BY
        aggregates.wins DESC,
        aggregates.win_rate DESC,
        aggregates.kills DESC,
        aggregates.games ASC,
        aggregates.last_played_at ASC,
        aggregates.profile_id ASC
    ) AS podium_rank
  FROM aggregates
  JOIN latest_identity
    ON latest_identity.day_key = aggregates.day_key
    AND latest_identity.profile_id = aggregates.profile_id
    AND latest_identity.identity_row = 1
)
INSERT OR IGNORE INTO daily_podium (
  day_key,
  mode_key,
  rank,
  profile_id,
  nickname_at_award,
  country_code,
  wins,
  awarded_at
)
SELECT
  day_key,
  '1v1',
  podium_rank,
  profile_id,
  player_nickname,
  country_code,
  wins,
  CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM ranked
WHERE podium_rank <= 3;

INSERT OR IGNORE INTO daily_podium_days (
  day_key,
  mode_key,
  participant_count,
  finalized_at
)
SELECT
  day_key,
  '1v1',
  COUNT(DISTINCT profile_id),
  CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM match_events
WHERE
  mode_key = '1v1'
  AND day_key < CASE
    WHEN time('now') >= '00:15:00' THEN date('now')
    ELSE date('now', '-1 day')
  END
GROUP BY day_key;
