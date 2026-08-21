import { ApiError } from "../../core/http";
import {
  nextSiteDay,
  nextSiteDayReset,
  previousSiteDay,
  siteDayKey,
  siteDayStart
} from "../../../lib/site-time";

export { previousSiteDay };

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALL_TIME_PERIOD_KEY = "__all__";

export type LeaderboardPeriod = "daily" | "allTime";

interface LeaderboardRow {
  rank: number;
  total_players: number;
  profile_id: string;
  nickname: string;
  country_code: string;
  games: number;
  wins: number;
  losses: number;
  kills: number;
  deaths: number;
  win_rate: number;
  best_win_streak: number;
  last_played_at: number;
  previous_day_rank: number | null;
  previous_day_wins: number;
  gold_medals: number;
  silver_medals: number;
  bronze_medals: number;
  total_medals: number;
}

export interface MedalCounts {
  gold: number;
  silver: number;
  bronze: number;
  total: number;
}

export interface LeaderboardEntry {
  rank: number;
  profileId: string;
  nickname: string;
  countryCode: string;
  games: number;
  wins: number;
  losses: number;
  kills: number;
  deaths: number;
  winRate: number;
  bestWinStreak: number;
  lastPlayedAt: number;
  previousDayRank: 1 | 2 | 3 | null;
  previousDayWins: number;
  medals: MedalCounts;
}

interface PodiumSnapshotRow {
  rank: number;
  total_players: number;
  profile_id: string;
  nickname: string;
  country_code: string;
  wins: number;
}

interface LeaderboardSnapshotStateRow {
  active_snapshot_id: string | null;
  generated_at: number;
  total_players: number;
  refresh_lock_until: number;
}

const DAILY_SNAPSHOT_MS = 3 * 60 * 60 * 1000;
const ALL_TIME_SNAPSHOT_MS = 24 * 60 * 60 * 1000;
const SNAPSHOT_BUILD_LOCK_MS = 2 * 60 * 1000;
const LIVE_REFRESH_COOLDOWN_MS = 5 * 60 * 1000;
const LIVE_REFRESH_DAILY_LIMIT = 12;

export function parseOptionalProfileId(value: string | null): string | null {
  if (!value) return null;
  if (!UUID_V4.test(value)) {
    throw new ApiError(400, "invalid_profile_id", "profileId must be a UUID v4.");
  }
  return value.toLowerCase();
}

function serializeRow(row: LeaderboardRow): LeaderboardEntry {
  const previousDayRank = Number(row.previous_day_rank);
  return {
    rank: Number(row.rank),
    profileId: row.profile_id,
    nickname: row.nickname,
    countryCode: row.country_code,
    games: Number(row.games),
    wins: Number(row.wins),
    losses: Number(row.losses),
    kills: Number(row.kills),
    deaths: Number(row.deaths),
    winRate: Number(row.win_rate),
    bestWinStreak: Number(row.best_win_streak),
    lastPlayedAt: Number(row.last_played_at),
    previousDayRank:
      previousDayRank >= 1 && previousDayRank <= 3
        ? previousDayRank as 1 | 2 | 3
        : null,
    previousDayWins: Math.max(0, Number(row.previous_day_wins || 0)),
    medals: {
      gold: Number(row.gold_medals),
      silver: Number(row.silver_medals),
      bronze: Number(row.bronze_medals),
      total: Number(row.total_medals)
    }
  };
}

export function leaderboardPeriodKey(
  period: LeaderboardPeriod,
  day: string | null
) {
  return period === "daily" ? day || "" : ALL_TIME_PERIOD_KEY;
}

export async function ensureDailyPodium(
  database: D1Database,
  day: string,
  now: number
): Promise<boolean> {
  const dayEnd = siteDayStart(nextSiteDay(day));
  if (!Number.isFinite(dayEnd) || now < dayEnd) return false;

  const finalized = await database.prepare(`
    SELECT 1 AS finalized
    FROM daily_podium_days
    WHERE day_key = ?1 AND mode_key = '1v1'
    LIMIT 1
  `).bind(day).first<{ finalized: number }>();
  if (finalized) return true;

  const result = await database.prepare(`
    SELECT
      ROW_NUMBER() OVER (
        ORDER BY
          wins DESC,
          win_rate_tenths DESC,
          kills DESC,
          games ASC,
          last_played_at ASC,
          profile_id ASC
      ) AS rank,
      COUNT(*) OVER () AS total_players,
      profile_id,
      nickname,
      country_code,
      wins
    FROM leaderboard_player_stats
    WHERE period_key = ?1
    ORDER BY rank ASC
    LIMIT 3
  `).bind(day).all<PodiumSnapshotRow>();

  const rows = result.results || [];
  const participantCount = rows.length ? Number(rows[0].total_players) : 0;
  const finalizeStatements = rows.map((row) => database.prepare(`
    INSERT OR IGNORE INTO daily_podium (
      day_key,
      mode_key,
      rank,
      profile_id,
      nickname_at_award,
      country_code,
      wins,
      awarded_at
    ) VALUES (?1, '1v1', ?2, ?3, ?4, ?5, ?6, ?7)
  `).bind(
    day,
    Number(row.rank),
    row.profile_id,
    row.nickname,
    row.country_code,
    Number(row.wins),
    now
  ));

  finalizeStatements.push(...rows.map((row) => database.prepare(`
    INSERT INTO leaderboard_medal_totals (
      profile_id,
      gold_medals,
      silver_medals,
      bronze_medals,
      total_medals,
      updated_at
    )
    SELECT
      ?1,
      CASE WHEN ?2 = 1 THEN 1 ELSE 0 END,
      CASE WHEN ?2 = 2 THEN 1 ELSE 0 END,
      CASE WHEN ?2 = 3 THEN 1 ELSE 0 END,
      1,
      ?3
    WHERE NOT EXISTS (
      SELECT 1
      FROM daily_podium_days
      WHERE day_key = ?4 AND mode_key = '1v1'
    )
    ON CONFLICT (profile_id) DO UPDATE SET
      gold_medals = leaderboard_medal_totals.gold_medals + excluded.gold_medals,
      silver_medals = leaderboard_medal_totals.silver_medals + excluded.silver_medals,
      bronze_medals = leaderboard_medal_totals.bronze_medals + excluded.bronze_medals,
      total_medals = leaderboard_medal_totals.total_medals + 1,
      updated_at = excluded.updated_at
  `).bind(row.profile_id, Number(row.rank), now, day)));

  finalizeStatements.push(database.prepare(`
    INSERT OR IGNORE INTO daily_podium_days (
      day_key,
      mode_key,
      participant_count,
      finalized_at
    ) VALUES (?1, '1v1', ?2, ?3)
  `).bind(day, participantCount, now));

  await database.batch(finalizeStatements);
  return true;
}

const LEADERBOARD_CTES = `
  WITH stored_previous_podium AS (
    SELECT
      profile_id,
      rank,
      nickname_at_award AS nickname,
      country_code,
      wins
    FROM daily_podium
    WHERE day_key = ?2 AND mode_key = '1v1'
  ),
  provisional_previous_ranked AS (
    SELECT
      profile_id,
      ROW_NUMBER() OVER (
        ORDER BY
          wins DESC,
          win_rate_tenths DESC,
          kills DESC,
          games ASC,
          last_played_at ASC,
          profile_id ASC
      ) AS rank,
      nickname,
      country_code,
      wins
    FROM leaderboard_player_stats
    WHERE
      period_key = ?2
      AND NOT EXISTS (SELECT 1 FROM stored_previous_podium)
  ),
  previous_podium AS (
    SELECT profile_id, rank, nickname, country_code, wins
    FROM stored_previous_podium
    UNION ALL
    SELECT profile_id, rank, nickname, country_code, wins
    FROM provisional_previous_ranked
    WHERE rank <= 3
  ),
  combined AS (
    SELECT
      stats.profile_id,
      stats.nickname,
      stats.country_code,
      stats.games,
      stats.wins,
      stats.losses,
      stats.kills,
      stats.deaths,
      stats.win_rate_tenths / 10.0 AS win_rate,
      stats.best_win_streak,
      stats.last_played_at,
      previous_podium.rank AS previous_day_rank,
      COALESCE(previous_podium.wins, 0) AS previous_day_wins,
      CASE WHEN ?2 IS NULL THEN COALESCE(medals.gold_medals, 0) ELSE 0 END
        AS gold_medals,
      CASE WHEN ?2 IS NULL THEN COALESCE(medals.silver_medals, 0) ELSE 0 END
        AS silver_medals,
      CASE WHEN ?2 IS NULL THEN COALESCE(medals.bronze_medals, 0) ELSE 0 END
        AS bronze_medals,
      CASE WHEN ?2 IS NULL THEN COALESCE(medals.total_medals, 0) ELSE 0 END
        AS total_medals
    FROM leaderboard_player_stats AS stats
    LEFT JOIN previous_podium
      ON previous_podium.profile_id = stats.profile_id
    LEFT JOIN leaderboard_medal_totals AS medals
      ON medals.profile_id = stats.profile_id
    WHERE stats.period_key = ?1
    UNION ALL
    SELECT
      previous_podium.profile_id,
      previous_podium.nickname,
      previous_podium.country_code,
      0 AS games,
      0 AS wins,
      0 AS losses,
      0 AS kills,
      0 AS deaths,
      0.0 AS win_rate,
      0 AS best_win_streak,
      0 AS last_played_at,
      previous_podium.rank AS previous_day_rank,
      previous_podium.wins AS previous_day_wins,
      0 AS gold_medals,
      0 AS silver_medals,
      0 AS bronze_medals,
      0 AS total_medals
    FROM previous_podium
    WHERE NOT EXISTS (
      SELECT 1
      FROM leaderboard_player_stats AS stats
      WHERE stats.period_key = ?1
        AND stats.profile_id = previous_podium.profile_id
    )
  ),
  ranked AS (
    SELECT
      *,
      ROW_NUMBER() OVER (
        ORDER BY
          wins DESC,
          CASE
            WHEN wins = 0 AND previous_day_rank IS NOT NULL THEN 0
            ELSE 1
          END ASC,
          CASE
            WHEN wins = 0 THEN COALESCE(previous_day_rank, 4)
            ELSE 0
          END ASC,
          win_rate DESC,
          kills DESC,
          games ASC,
          last_played_at ASC,
          profile_id ASC
      ) AS rank
    FROM combined
  ),
  with_total AS (
    SELECT *, COUNT(*) OVER () AS total_players
    FROM ranked
  )
`;

function snapshotTtl(period: LeaderboardPeriod) {
  return period === "daily" ? DAILY_SNAPSHOT_MS : ALL_TIME_SNAPSHOT_MS;
}

async function readSnapshotState(
  database: D1Database,
  key: string
) {
  return database.prepare(`
    SELECT
      active_snapshot_id,
      generated_at,
      total_players,
      refresh_lock_until
    FROM leaderboard_snapshot_state
    WHERE period_key = ?1
    LIMIT 1
  `).bind(key).first<LeaderboardSnapshotStateRow>();
}

async function rebuildLeaderboardSnapshot(
  database: D1Database,
  options: {
    period: LeaderboardPeriod;
    day: string | null;
    previousDay: string | null;
    now: number;
  }
) {
  const key = leaderboardPeriodKey(options.period, options.day);
  const staleRefreshWindowBefore = previousSiteDay(
    previousSiteDay(siteDayKey(options.now))
  );
  const lockUntil = options.now + SNAPSHOT_BUILD_LOCK_MS;
  const lock = await database.prepare(`
    INSERT INTO leaderboard_snapshot_state (
      period_key,
      active_snapshot_id,
      generated_at,
      total_players,
      refresh_lock_until
    ) VALUES (?1, NULL, 0, 0, ?2)
    ON CONFLICT (period_key) DO UPDATE SET
      refresh_lock_until = excluded.refresh_lock_until
    WHERE leaderboard_snapshot_state.refresh_lock_until <= ?3
  `).bind(key, lockUntil, options.now).run();

  if ((lock.meta.changes || 0) <= 0) return null;

  const snapshotId = `${key}:${options.now}:${crypto.randomUUID()}`;
  try {
    const inserted = await database.prepare(`
      ${LEADERBOARD_CTES}
      INSERT INTO leaderboard_rank_snapshots (
        snapshot_id,
        period_key,
        profile_id,
        rank,
        nickname,
        country_code,
        games,
        wins,
        losses,
        kills,
        deaths,
        win_rate_tenths,
        best_win_streak,
        last_played_at,
        previous_day_rank,
        previous_day_wins,
        gold_medals,
        silver_medals,
        bronze_medals,
        total_medals
      )
      SELECT
        ?3,
        ?1,
        profile_id,
        rank,
        nickname,
        country_code,
        games,
        wins,
        losses,
        kills,
        deaths,
        CAST(ROUND(win_rate * 10.0) AS INTEGER),
        best_win_streak,
        last_played_at,
        previous_day_rank,
        previous_day_wins,
        gold_medals,
        silver_medals,
        bronze_medals,
        total_medals
      FROM with_total
    `).bind(key, options.previousDay, snapshotId).run();
    const totalPlayers = Number(inserted.meta.changes || 0);

    const activated = await database.prepare(`
      UPDATE leaderboard_snapshot_state
      SET
        active_snapshot_id = ?1,
        generated_at = ?2,
        total_players = ?3,
        refresh_lock_until = 0
      WHERE period_key = ?4 AND refresh_lock_until = ?5
    `).bind(
      snapshotId,
      options.now,
      totalPlayers,
      key,
      lockUntil
    ).run();

    if ((activated.meta.changes || 0) <= 0) {
      await database.prepare(`
        DELETE FROM leaderboard_rank_snapshots
        WHERE snapshot_id = ?1
      `).bind(snapshotId).run();
      return null;
    }

    await database.batch([
      database.prepare(`
        DELETE FROM leaderboard_rank_snapshots
        WHERE period_key = ?1 AND snapshot_id <> ?2
      `).bind(key, snapshotId),
      database.prepare(`
        DELETE FROM leaderboard_live_refresh_limits
        WHERE window_day < ?1
      `).bind(staleRefreshWindowBefore)
    ]);

    return readSnapshotState(database, key);
  } catch (error) {
    await database.prepare(`
      UPDATE leaderboard_snapshot_state
      SET refresh_lock_until = 0
      WHERE period_key = ?1 AND refresh_lock_until = ?2
    `).bind(key, lockUntil).run();
    throw error;
  }
}

async function getLeaderboardSnapshot(
  database: D1Database,
  options: {
    period: LeaderboardPeriod;
    day: string | null;
    previousDay: string | null;
    now: number;
    waitUntil?: (promise: Promise<unknown>) => void;
  }
) {
  const key = leaderboardPeriodKey(options.period, options.day);
  let state = await readSnapshotState(database, key);

  if (!state?.active_snapshot_id) {
    await rebuildLeaderboardSnapshot(database, options);
    state = await readSnapshotState(database, key);
    return state?.active_snapshot_id ? state : null;
  }

  const currentSiteDayStartedAt = siteDayStart(siteDayKey(options.now));
  if (
    options.period === "allTime" &&
    Number(state.generated_at) < currentSiteDayStartedAt
  ) {
    const rebuiltState = await rebuildLeaderboardSnapshot(database, options);
    if (rebuiltState?.active_snapshot_id) return rebuiltState;
    state = await readSnapshotState(database, key);
    return state?.active_snapshot_id &&
        Number(state.generated_at) >= currentSiteDayStartedAt
      ? state
      : null;
  }

  if (options.now - Number(state.generated_at) >= snapshotTtl(options.period)) {
    const refresh = rebuildLeaderboardSnapshot(database, options).catch(
      (error) => console.error("Leaderboard snapshot refresh failed", error)
    );
    if (options.waitUntil) options.waitUntil(refresh);
    else await refresh;
  }

  return state;
}

export async function queryLeaderboardSnapshotPage(
  database: D1Database,
  options: {
    period: LeaderboardPeriod;
    day: string | null;
    limit: number;
    offset: number;
    previousDay: string | null;
    now: number;
    waitUntil?: (promise: Promise<unknown>) => void;
  }
) {
  const state = await getLeaderboardSnapshot(database, options);
  if (!state?.active_snapshot_id) return null;

  const result = await database.prepare(`
    SELECT
      rank,
      ?2 AS total_players,
      profile_id,
      nickname,
      country_code,
      games,
      wins,
      losses,
      kills,
      deaths,
      win_rate_tenths / 10.0 AS win_rate,
      best_win_streak,
      last_played_at,
      previous_day_rank,
      previous_day_wins,
      gold_medals,
      silver_medals,
      bronze_medals,
      total_medals
    FROM leaderboard_rank_snapshots
    WHERE snapshot_id = ?1
      AND rank > ?3
      AND rank <= ?3 + ?4
    UNION ALL
    SELECT
      rank,
      ?2 AS total_players,
      profile_id,
      nickname,
      country_code,
      games,
      wins,
      losses,
      kills,
      deaths,
      win_rate_tenths / 10.0 AS win_rate,
      best_win_streak,
      last_played_at,
      previous_day_rank,
      previous_day_wins,
      gold_medals,
      silver_medals,
      bronze_medals,
      total_medals
    FROM leaderboard_rank_snapshots
    WHERE snapshot_id = ?1
      AND rank = ?2
      AND NOT (rank > ?3 AND rank <= ?3 + ?4)
    ORDER BY rank ASC
  `).bind(
    state.active_snapshot_id,
    Number(state.total_players),
    options.offset,
    options.limit
  ).all<LeaderboardRow>();

  const rows = result.results || [];
  const totalPlayers = Number(state.total_players);
  const serialized = rows.map(serializeRow);

  return {
    generatedAt: Number(state.generated_at),
    dataSource: "snapshot" as const,
    totalPlayers,
    entries: serialized.filter(
      (entry) =>
        entry.rank > options.offset &&
        entry.rank <= options.offset + options.limit
    ),
    currentPlayer: null,
    currentWindow: [] as LeaderboardEntry[],
    lastPlayer: serialized.find((entry) => entry.rank === totalPlayers) || null
  };
}

export async function queryLeaderboardSnapshotContext(
  database: D1Database,
  options: {
    period: LeaderboardPeriod;
    day: string | null;
    profileId: string;
    previousDay: string | null;
    now: number;
    waitUntil?: (promise: Promise<unknown>) => void;
  }
) {
  const state = await getLeaderboardSnapshot(database, options);
  if (!state?.active_snapshot_id) return null;

  const result = await database.prepare(`
    WITH current_position AS (
      SELECT rank
      FROM leaderboard_rank_snapshots
      WHERE snapshot_id = ?1 AND profile_id = ?3
      LIMIT 1
    )
    SELECT
      rank,
      ?2 AS total_players,
      profile_id,
      nickname,
      country_code,
      games,
      wins,
      losses,
      kills,
      deaths,
      win_rate_tenths / 10.0 AS win_rate,
      best_win_streak,
      last_played_at,
      previous_day_rank,
      previous_day_wins,
      gold_medals,
      silver_medals,
      bronze_medals,
      total_medals
    FROM leaderboard_rank_snapshots
    WHERE snapshot_id = ?1
      AND rank BETWEEN
        COALESCE((SELECT rank FROM current_position), -10) - 1
        AND COALESCE((SELECT rank FROM current_position), -10) + 1
    ORDER BY rank ASC
  `).bind(
    state.active_snapshot_id,
    Number(state.total_players),
    options.profileId
  ).all<LeaderboardRow>();

  const serialized = (result.results || []).map(serializeRow);
  const currentPlayer = serialized.find(
    (entry) => entry.profileId === options.profileId
  ) || null;

  return {
    generatedAt: Number(state.generated_at),
    dataSource: "snapshot" as const,
    totalPlayers: Number(state.total_players),
    currentPlayer,
    currentWindow: currentPlayer && currentPlayer.rank > 3
      ? serialized.filter(
          (entry) => Math.abs(entry.rank - currentPlayer.rank) <= 1
        )
      : []
  };
}

export async function queryLeaderboardPage(
  database: D1Database,
  options: {
    period: LeaderboardPeriod;
    day: string | null;
    limit: number;
    offset: number;
    previousDay: string | null;
  }
) {
  const result = await database.prepare(`
    ${LEADERBOARD_CTES}
    SELECT *
    FROM with_total
    WHERE
      (rank > ?3 AND rank <= ?3 + ?4)
      OR rank = total_players
    ORDER BY rank ASC
  `).bind(
    leaderboardPeriodKey(options.period, options.day),
    options.previousDay,
    options.offset,
    options.limit
  ).all<LeaderboardRow>();

  const rows = result.results || [];
  const totalPlayers = rows.length ? Number(rows[0].total_players) : 0;
  const serialized = rows.map(serializeRow);
  const entries = serialized.filter(
    (entry) =>
      entry.rank > options.offset &&
      entry.rank <= options.offset + options.limit
  );
  const lastPlayer = serialized.find(
    (entry) => entry.rank === totalPlayers
  ) || null;

  return {
    totalPlayers,
    entries,
    currentPlayer: null,
    currentWindow: [] as LeaderboardEntry[],
    lastPlayer
  };
}

export async function queryLeaderboardContext(
  database: D1Database,
  options: {
    period: LeaderboardPeriod;
    day: string | null;
    profileId: string;
    previousDay: string | null;
  }
) {
  const result = await database.prepare(`
    ${LEADERBOARD_CTES},
    current_position AS (
      SELECT rank
      FROM with_total
      WHERE profile_id = ?3
    )
    SELECT *
    FROM with_total
    WHERE rank BETWEEN
      COALESCE((SELECT rank FROM current_position), -10) - 1
      AND COALESCE((SELECT rank FROM current_position), -10) + 1
    ORDER BY rank ASC
  `).bind(
    leaderboardPeriodKey(options.period, options.day),
    options.previousDay,
    options.profileId
  ).all<LeaderboardRow>();

  const rows = result.results || [];
  const serialized = rows.map(serializeRow);
  const currentPlayer = serialized.find(
    (entry) => entry.profileId === options.profileId
  ) || null;

  return {
    totalPlayers: rows.length ? Number(rows[0].total_players) : 0,
    currentPlayer,
    currentWindow: currentPlayer && currentPlayer.rank > 3
      ? serialized.filter(
          (entry) => Math.abs(entry.rank - currentPlayer.rank) <= 1
        )
      : []
  };
}

export async function consumeLiveLeaderboardRefresh(
  database: D1Database,
  options: {
    period: LeaderboardPeriod;
    day: string | null;
    profileId: string;
    now: number;
  }
) {
  const key = leaderboardPeriodKey(options.period, options.day);
  const eligible = await database.prepare(`
    SELECT 1 AS eligible
    FROM leaderboard_player_stats
    WHERE period_key = ?1 AND profile_id = ?2
    LIMIT 1
  `).bind(key, options.profileId).first<{ eligible: number }>();

  if (!eligible) {
    throw new ApiError(
      403,
      "live_refresh_not_eligible",
      options.period === "daily"
        ? "Play a match today to unlock live rankings."
        : "Play a match to unlock live rankings."
    );
  }

  const windowDay = siteDayKey(options.now);
  const accepted = await database.prepare(`
    INSERT INTO leaderboard_live_refresh_limits (
      window_day,
      period_key,
      profile_id,
      last_refreshed_at,
      refresh_count
    ) VALUES (?1, ?2, ?3, ?4, 1)
    ON CONFLICT (window_day, period_key, profile_id) DO UPDATE SET
      last_refreshed_at = excluded.last_refreshed_at,
      refresh_count = leaderboard_live_refresh_limits.refresh_count + 1
    WHERE
      leaderboard_live_refresh_limits.last_refreshed_at <= ?5
      AND leaderboard_live_refresh_limits.refresh_count < ?6
  `).bind(
    windowDay,
    key,
    options.profileId,
    options.now,
    options.now - LIVE_REFRESH_COOLDOWN_MS,
    LIVE_REFRESH_DAILY_LIMIT
  ).run();

  const current = await database.prepare(`
    SELECT last_refreshed_at, refresh_count
    FROM leaderboard_live_refresh_limits
    WHERE window_day = ?1 AND period_key = ?2 AND profile_id = ?3
    LIMIT 1
  `).bind(windowDay, key, options.profileId).first<{
    last_refreshed_at: number;
    refresh_count: number;
  }>();
  const refreshCount = Number(current?.refresh_count || 0);
  if ((accepted.meta.changes || 0) > 0) {
    const limitResetAt = nextSiteDayReset(options.now);
    return {
      refreshCount,
      dailyLimit: LIVE_REFRESH_DAILY_LIMIT,
      remaining: Math.max(0, LIVE_REFRESH_DAILY_LIMIT - refreshCount),
      retryAt: refreshCount >= LIVE_REFRESH_DAILY_LIMIT
        ? limitResetAt
        : options.now + LIVE_REFRESH_COOLDOWN_MS
    };
  }

  const retryAt = refreshCount >= LIVE_REFRESH_DAILY_LIMIT
    ? nextSiteDayReset(options.now)
    : Number(current?.last_refreshed_at || options.now) +
      LIVE_REFRESH_COOLDOWN_MS;

  throw new ApiError(
    429,
    refreshCount >= LIVE_REFRESH_DAILY_LIMIT
      ? "live_refresh_daily_limit"
      : "live_refresh_cooldown",
    refreshCount >= LIVE_REFRESH_DAILY_LIMIT
      ? "The daily live refresh limit has been reached."
      : "Live rankings can be refreshed once every 5 minutes.",
    {
      retryAt,
      dailyLimit: LIVE_REFRESH_DAILY_LIMIT,
      refreshCount,
      remaining: Math.max(0, LIVE_REFRESH_DAILY_LIMIT - refreshCount)
    }
  );
}

export async function queryLiveLeaderboard(
  database: D1Database,
  options: {
    period: LeaderboardPeriod;
    day: string | null;
    limit: number;
    offset: number;
    profileId: string;
    previousDay: string | null;
  }
) {
  const result = await database.prepare(`
    ${LEADERBOARD_CTES},
    current_position AS (
      SELECT rank
      FROM with_total
      WHERE profile_id = ?5
      LIMIT 1
    )
    SELECT *
    FROM with_total
    WHERE
      (rank > ?3 AND rank <= ?3 + ?4)
      OR rank = total_players
      OR rank BETWEEN
        COALESCE((SELECT rank FROM current_position), -10) - 1
        AND COALESCE((SELECT rank FROM current_position), -10) + 1
    ORDER BY rank ASC
  `).bind(
    leaderboardPeriodKey(options.period, options.day),
    options.previousDay,
    options.offset,
    options.limit,
    options.profileId
  ).all<LeaderboardRow>();

  const rows = result.results || [];
  const totalPlayers = rows.length ? Number(rows[0].total_players) : 0;
  const serialized = rows.map(serializeRow);
  const entries = serialized.filter(
    (entry) =>
      entry.rank > options.offset &&
      entry.rank <= options.offset + options.limit
  );
  const currentPlayer = serialized.find(
    (entry) => entry.profileId === options.profileId
  ) || null;

  return {
    totalPlayers,
    entries,
    currentPlayer,
    currentWindow: currentPlayer && currentPlayer.rank > 3
      ? serialized.filter(
          (entry) => Math.abs(entry.rank - currentPlayer.rank) <= 1
        )
      : [],
    lastPlayer: serialized.find(
      (entry) => entry.rank === totalPlayers
    ) || null
  };
}
