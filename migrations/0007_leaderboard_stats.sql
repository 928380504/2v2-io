CREATE TABLE IF NOT EXISTS leaderboard_player_stats (
  period_key TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  nickname TEXT NOT NULL,
  country_code TEXT NOT NULL DEFAULT 'XX',
  games INTEGER NOT NULL DEFAULT 0 CHECK (games >= 0),
  wins INTEGER NOT NULL DEFAULT 0 CHECK (wins >= 0),
  losses INTEGER NOT NULL DEFAULT 0 CHECK (losses >= 0),
  kills INTEGER NOT NULL DEFAULT 0 CHECK (kills >= 0),
  deaths INTEGER NOT NULL DEFAULT 0 CHECK (deaths >= 0),
  win_rate_tenths INTEGER NOT NULL DEFAULT 0 CHECK (win_rate_tenths >= 0),
  current_win_streak INTEGER NOT NULL DEFAULT 0 CHECK (current_win_streak >= 0),
  best_win_streak INTEGER NOT NULL DEFAULT 0 CHECK (best_win_streak >= 0),
  last_played_at INTEGER NOT NULL,
  identity_event_id TEXT NOT NULL,
  last_occurred_at INTEGER NOT NULL,
  last_occurred_event_id TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (period_key, profile_id)
);

CREATE INDEX IF NOT EXISTS leaderboard_player_stats_rank_idx
  ON leaderboard_player_stats (
    period_key,
    wins DESC,
    win_rate_tenths DESC,
    kills DESC,
    games ASC,
    last_played_at ASC,
    profile_id ASC
  );

CREATE TABLE IF NOT EXISTS leaderboard_medal_totals (
  profile_id TEXT PRIMARY KEY,
  gold_medals INTEGER NOT NULL DEFAULT 0 CHECK (gold_medals >= 0),
  silver_medals INTEGER NOT NULL DEFAULT 0 CHECK (silver_medals >= 0),
  bronze_medals INTEGER NOT NULL DEFAULT 0 CHECK (bronze_medals >= 0),
  total_medals INTEGER NOT NULL DEFAULT 0 CHECK (total_medals >= 0),
  updated_at INTEGER NOT NULL
);

-- One-time backfill. Each match contributes to its stored site day and __all__.
WITH expanded AS (
  SELECT day_key AS period_key, *
  FROM match_events
  WHERE mode_key = '1v1'
  UNION ALL
  SELECT '__all__' AS period_key, *
  FROM match_events
  WHERE mode_key = '1v1'
),
latest_identity AS (
  SELECT
    period_key,
    profile_id,
    player_nickname,
    country_code,
    event_id,
    ROW_NUMBER() OVER (
      PARTITION BY period_key, profile_id
      ORDER BY received_at DESC, event_id DESC
    ) AS identity_row
  FROM expanded
),
ordered_streaks AS (
  SELECT
    period_key,
    profile_id,
    result,
    SUM(CASE WHEN result = 'loss' THEN 1 ELSE 0 END) OVER (
      PARTITION BY period_key, profile_id
      ORDER BY occurred_at, event_id
    ) AS loss_group,
    SUM(CASE WHEN result = 'loss' THEN 1 ELSE 0 END) OVER (
      PARTITION BY period_key, profile_id
      ORDER BY occurred_at DESC, event_id DESC
    ) AS reverse_loss_group
  FROM expanded
),
best_streaks AS (
  SELECT period_key, profile_id, MAX(streak) AS best_win_streak
  FROM (
    SELECT period_key, profile_id, loss_group, COUNT(*) AS streak
    FROM ordered_streaks
    WHERE result = 'win'
    GROUP BY period_key, profile_id, loss_group
  )
  GROUP BY period_key, profile_id
),
current_streaks AS (
  SELECT
    period_key,
    profile_id,
    SUM(CASE
      WHEN result = 'win' AND reverse_loss_group = 0 THEN 1
      ELSE 0
    END) AS current_win_streak
  FROM ordered_streaks
  GROUP BY period_key, profile_id
),
latest_result AS (
  SELECT
    period_key,
    profile_id,
    occurred_at,
    event_id,
    ROW_NUMBER() OVER (
      PARTITION BY period_key, profile_id
      ORDER BY occurred_at DESC, event_id DESC
    ) AS result_row
  FROM expanded
),
aggregates AS (
  SELECT
    period_key,
    profile_id,
    COUNT(*) AS games,
    SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) AS wins,
    SUM(CASE WHEN result = 'loss' THEN 1 ELSE 0 END) AS losses,
    SUM(kills) AS kills,
    SUM(deaths) AS deaths,
    CAST(ROUND(
      1000.0 * SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) / COUNT(*)
    ) AS INTEGER) AS win_rate_tenths,
    MAX(received_at) AS last_played_at,
    MAX(received_at) AS updated_at
  FROM expanded
  GROUP BY period_key, profile_id
)
INSERT OR REPLACE INTO leaderboard_player_stats (
  period_key,
  profile_id,
  nickname,
  country_code,
  games,
  wins,
  losses,
  kills,
  deaths,
  win_rate_tenths,
  current_win_streak,
  best_win_streak,
  last_played_at,
  identity_event_id,
  last_occurred_at,
  last_occurred_event_id,
  updated_at
)
SELECT
  aggregates.period_key,
  aggregates.profile_id,
  latest_identity.player_nickname,
  latest_identity.country_code,
  aggregates.games,
  aggregates.wins,
  aggregates.losses,
  aggregates.kills,
  aggregates.deaths,
  aggregates.win_rate_tenths,
  COALESCE(current_streaks.current_win_streak, 0),
  COALESCE(best_streaks.best_win_streak, 0),
  aggregates.last_played_at,
  latest_identity.event_id,
  latest_result.occurred_at,
  latest_result.event_id,
  aggregates.updated_at
FROM aggregates
JOIN latest_identity
  ON latest_identity.period_key = aggregates.period_key
  AND latest_identity.profile_id = aggregates.profile_id
  AND latest_identity.identity_row = 1
JOIN latest_result
  ON latest_result.period_key = aggregates.period_key
  AND latest_result.profile_id = aggregates.profile_id
  AND latest_result.result_row = 1
LEFT JOIN best_streaks
  ON best_streaks.period_key = aggregates.period_key
  AND best_streaks.profile_id = aggregates.profile_id
LEFT JOIN current_streaks
  ON current_streaks.period_key = aggregates.period_key
  AND current_streaks.profile_id = aggregates.profile_id;

INSERT OR REPLACE INTO leaderboard_medal_totals (
  profile_id,
  gold_medals,
  silver_medals,
  bronze_medals,
  total_medals,
  updated_at
)
SELECT
  profile_id,
  SUM(CASE WHEN rank = 1 THEN 1 ELSE 0 END),
  SUM(CASE WHEN rank = 2 THEN 1 ELSE 0 END),
  SUM(CASE WHEN rank = 3 THEN 1 ELSE 0 END),
  COUNT(*),
  CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM daily_podium
WHERE mode_key = '1v1'
GROUP BY profile_id;

CREATE TRIGGER IF NOT EXISTS trg_match_events_leaderboard_daily
AFTER INSERT ON match_events
WHEN NEW.mode_key = '1v1'
BEGIN
  INSERT INTO leaderboard_player_stats (
    period_key, profile_id, nickname, country_code,
    games, wins, losses, kills, deaths, win_rate_tenths,
    current_win_streak, best_win_streak,
    last_played_at, identity_event_id,
    last_occurred_at, last_occurred_event_id, updated_at
  ) VALUES (
    NEW.day_key, NEW.profile_id, NEW.player_nickname, NEW.country_code,
    1,
    CASE WHEN NEW.result = 'win' THEN 1 ELSE 0 END,
    CASE WHEN NEW.result = 'loss' THEN 1 ELSE 0 END,
    NEW.kills, NEW.deaths,
    CASE WHEN NEW.result = 'win' THEN 1000 ELSE 0 END,
    CASE WHEN NEW.result = 'win' THEN 1 ELSE 0 END,
    CASE WHEN NEW.result = 'win' THEN 1 ELSE 0 END,
    NEW.received_at, NEW.event_id,
    NEW.occurred_at, NEW.event_id, NEW.received_at
  )
  ON CONFLICT (period_key, profile_id) DO UPDATE SET
    nickname = CASE
      WHEN excluded.last_played_at > leaderboard_player_stats.last_played_at
        OR (
          excluded.last_played_at = leaderboard_player_stats.last_played_at
          AND excluded.identity_event_id > leaderboard_player_stats.identity_event_id
        )
      THEN excluded.nickname ELSE leaderboard_player_stats.nickname
    END,
    country_code = CASE
      WHEN excluded.last_played_at > leaderboard_player_stats.last_played_at
        OR (
          excluded.last_played_at = leaderboard_player_stats.last_played_at
          AND excluded.identity_event_id > leaderboard_player_stats.identity_event_id
        )
      THEN excluded.country_code ELSE leaderboard_player_stats.country_code
    END,
    games = leaderboard_player_stats.games + 1,
    wins = leaderboard_player_stats.wins + excluded.wins,
    losses = leaderboard_player_stats.losses + excluded.losses,
    kills = leaderboard_player_stats.kills + excluded.kills,
    deaths = leaderboard_player_stats.deaths + excluded.deaths,
    win_rate_tenths = CAST(ROUND(
      1000.0 * (leaderboard_player_stats.wins + excluded.wins) /
      (leaderboard_player_stats.games + 1)
    ) AS INTEGER),
    current_win_streak = CASE
      WHEN excluded.last_occurred_at < leaderboard_player_stats.last_occurred_at
        OR (
          excluded.last_occurred_at = leaderboard_player_stats.last_occurred_at
          AND excluded.last_occurred_event_id <= leaderboard_player_stats.last_occurred_event_id
        )
      THEN leaderboard_player_stats.current_win_streak
      WHEN excluded.wins = 1
      THEN leaderboard_player_stats.current_win_streak + 1
      ELSE 0
    END,
    best_win_streak = MAX(
      leaderboard_player_stats.best_win_streak,
      CASE
        WHEN excluded.wins = 1
          AND (
            excluded.last_occurred_at > leaderboard_player_stats.last_occurred_at
            OR (
              excluded.last_occurred_at = leaderboard_player_stats.last_occurred_at
              AND excluded.last_occurred_event_id > leaderboard_player_stats.last_occurred_event_id
            )
          )
        THEN leaderboard_player_stats.current_win_streak + 1
        ELSE excluded.best_win_streak
      END
    ),
    last_played_at = MAX(leaderboard_player_stats.last_played_at, excluded.last_played_at),
    identity_event_id = CASE
      WHEN excluded.last_played_at > leaderboard_player_stats.last_played_at
        OR (
          excluded.last_played_at = leaderboard_player_stats.last_played_at
          AND excluded.identity_event_id > leaderboard_player_stats.identity_event_id
        )
      THEN excluded.identity_event_id ELSE leaderboard_player_stats.identity_event_id
    END,
    last_occurred_at = MAX(
      leaderboard_player_stats.last_occurred_at,
      excluded.last_occurred_at
    ),
    last_occurred_event_id = CASE
      WHEN excluded.last_occurred_at > leaderboard_player_stats.last_occurred_at
        OR (
          excluded.last_occurred_at = leaderboard_player_stats.last_occurred_at
          AND excluded.last_occurred_event_id > leaderboard_player_stats.last_occurred_event_id
        )
      THEN excluded.last_occurred_event_id
      ELSE leaderboard_player_stats.last_occurred_event_id
    END,
    updated_at = MAX(leaderboard_player_stats.updated_at, excluded.updated_at);
END;

CREATE TRIGGER IF NOT EXISTS trg_match_events_leaderboard_all_time
AFTER INSERT ON match_events
WHEN NEW.mode_key = '1v1'
BEGIN
  INSERT INTO leaderboard_player_stats (
    period_key, profile_id, nickname, country_code,
    games, wins, losses, kills, deaths, win_rate_tenths,
    current_win_streak, best_win_streak,
    last_played_at, identity_event_id,
    last_occurred_at, last_occurred_event_id, updated_at
  ) VALUES (
    '__all__', NEW.profile_id, NEW.player_nickname, NEW.country_code,
    1,
    CASE WHEN NEW.result = 'win' THEN 1 ELSE 0 END,
    CASE WHEN NEW.result = 'loss' THEN 1 ELSE 0 END,
    NEW.kills, NEW.deaths,
    CASE WHEN NEW.result = 'win' THEN 1000 ELSE 0 END,
    CASE WHEN NEW.result = 'win' THEN 1 ELSE 0 END,
    CASE WHEN NEW.result = 'win' THEN 1 ELSE 0 END,
    NEW.received_at, NEW.event_id,
    NEW.occurred_at, NEW.event_id, NEW.received_at
  )
  ON CONFLICT (period_key, profile_id) DO UPDATE SET
    nickname = CASE
      WHEN excluded.last_played_at > leaderboard_player_stats.last_played_at
        OR (
          excluded.last_played_at = leaderboard_player_stats.last_played_at
          AND excluded.identity_event_id > leaderboard_player_stats.identity_event_id
        )
      THEN excluded.nickname ELSE leaderboard_player_stats.nickname
    END,
    country_code = CASE
      WHEN excluded.last_played_at > leaderboard_player_stats.last_played_at
        OR (
          excluded.last_played_at = leaderboard_player_stats.last_played_at
          AND excluded.identity_event_id > leaderboard_player_stats.identity_event_id
        )
      THEN excluded.country_code ELSE leaderboard_player_stats.country_code
    END,
    games = leaderboard_player_stats.games + 1,
    wins = leaderboard_player_stats.wins + excluded.wins,
    losses = leaderboard_player_stats.losses + excluded.losses,
    kills = leaderboard_player_stats.kills + excluded.kills,
    deaths = leaderboard_player_stats.deaths + excluded.deaths,
    win_rate_tenths = CAST(ROUND(
      1000.0 * (leaderboard_player_stats.wins + excluded.wins) /
      (leaderboard_player_stats.games + 1)
    ) AS INTEGER),
    current_win_streak = CASE
      WHEN excluded.last_occurred_at < leaderboard_player_stats.last_occurred_at
        OR (
          excluded.last_occurred_at = leaderboard_player_stats.last_occurred_at
          AND excluded.last_occurred_event_id <= leaderboard_player_stats.last_occurred_event_id
        )
      THEN leaderboard_player_stats.current_win_streak
      WHEN excluded.wins = 1
      THEN leaderboard_player_stats.current_win_streak + 1
      ELSE 0
    END,
    best_win_streak = MAX(
      leaderboard_player_stats.best_win_streak,
      CASE
        WHEN excluded.wins = 1
          AND (
            excluded.last_occurred_at > leaderboard_player_stats.last_occurred_at
            OR (
              excluded.last_occurred_at = leaderboard_player_stats.last_occurred_at
              AND excluded.last_occurred_event_id > leaderboard_player_stats.last_occurred_event_id
            )
          )
        THEN leaderboard_player_stats.current_win_streak + 1
        ELSE excluded.best_win_streak
      END
    ),
    last_played_at = MAX(leaderboard_player_stats.last_played_at, excluded.last_played_at),
    identity_event_id = CASE
      WHEN excluded.last_played_at > leaderboard_player_stats.last_played_at
        OR (
          excluded.last_played_at = leaderboard_player_stats.last_played_at
          AND excluded.identity_event_id > leaderboard_player_stats.identity_event_id
        )
      THEN excluded.identity_event_id ELSE leaderboard_player_stats.identity_event_id
    END,
    last_occurred_at = MAX(
      leaderboard_player_stats.last_occurred_at,
      excluded.last_occurred_at
    ),
    last_occurred_event_id = CASE
      WHEN excluded.last_occurred_at > leaderboard_player_stats.last_occurred_at
        OR (
          excluded.last_occurred_at = leaderboard_player_stats.last_occurred_at
          AND excluded.last_occurred_event_id > leaderboard_player_stats.last_occurred_event_id
        )
      THEN excluded.last_occurred_event_id
      ELSE leaderboard_player_stats.last_occurred_event_id
    END,
    updated_at = MAX(leaderboard_player_stats.updated_at, excluded.updated_at);
END;
