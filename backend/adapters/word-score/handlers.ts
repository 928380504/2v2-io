import { countryCodeFromRequest, requireDatabase } from "../../core/database";
import {
  ApiError,
  cachedJson,
  errorResponse,
  nextSiteDayReset,
  noStoreJson,
  optionsResponse,
  parseDay,
  parseIntegerQuery,
  readJsonBody,
  siteDayKey,
} from "../../core/http";
import { normalizeScoreBatch, type NormalizedScoreEvent } from "./score-event";

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALL_TIME_PERIOD_KEY = "__all__";
const LIVE_REFRESH_COOLDOWN_MS = 5 * 60 * 1000;
const LIVE_REFRESH_DAILY_LIMIT = 12;

type LeaderboardPeriod = "daily" | "allTime";

interface ScoreStatsRow {
  rank: number;
  total_players: number;
  profile_id: string;
  nickname: string;
  country_code: string;
  runs: number;
  best_score: number;
  best_rounds: number;
  best_words: number;
  best_longest_word: number;
  best_bingo_words: number;
  best_achieved_at: number;
  last_played_at: number;
}

interface LiveRefreshRow {
  refresh_count: number;
  last_refreshed_at: number;
}

const RANKED_CTE = `
  WITH ranked AS (
    SELECT
      ROW_NUMBER() OVER (
        ORDER BY
          best_score DESC,
          best_rounds DESC,
          best_words DESC,
          best_bingo_words DESC,
          best_longest_word DESC,
          best_achieved_at ASC,
          profile_id ASC
      ) AS rank,
      COUNT(*) OVER () AS total_players,
      profile_id,
      nickname,
      country_code,
      runs,
      best_score,
      best_rounds,
      best_words,
      best_longest_word,
      best_bingo_words,
      best_achieved_at,
      last_played_at
    FROM word_score_player_stats
    WHERE period_key = ?1
  )
`;

export const options: PagesFunction = async () => optionsResponse();

function parsePeriod(value: string | null): LeaderboardPeriod {
  return value === "allTime" ? "allTime" : "daily";
}

function parseProfileId(value: string | null) {
  if (!value) return null;
  if (!UUID_V4.test(value)) {
    throw new ApiError(400, "invalid_profile_id", "profileId must be a UUID v4.");
  }
  return value.toLowerCase();
}

function periodKey(period: LeaderboardPeriod, day: string | null) {
  return period === "daily" ? day || "" : ALL_TIME_PERIOD_KEY;
}

function serializeScoreRow(row: ScoreStatsRow) {
  return {
    rank: Number(row.rank),
    profileId: row.profile_id,
    nickname: row.nickname,
    countryCode: row.country_code,
    runs: Number(row.runs),
    games: Number(row.runs),
    bestScore: Number(row.best_score),
    roundsCompleted: Number(row.best_rounds),
    wordsFound: Number(row.best_words),
    longestWordLength: Number(row.best_longest_word),
    bingoWordsFound: Number(row.best_bingo_words),
    achievedAt: Number(row.best_achieved_at),
    lastPlayedAt: Number(row.last_played_at),
    previousDayRank: null,
    previousDayBestScore: 0,
    medals: { gold: 0, silver: 0, bronze: 0, total: 0 },
  };
}

async function queryPage(
  database: D1Database,
  key: string,
  limit: number,
  offset: number,
) {
  const result = await database.prepare(`
    ${RANKED_CTE}
    SELECT *
    FROM ranked
    WHERE (rank > ?2 AND rank <= ?2 + ?3) OR rank = total_players
    ORDER BY rank ASC
  `).bind(key, offset, limit).all<ScoreStatsRow>();
  const rows = result.results || [];
  const totalPlayers = rows.length ? Number(rows[0].total_players) : 0;
  const serialized = rows.map(serializeScoreRow);
  return {
    totalPlayers,
    entries: serialized.filter(
      (entry) => entry.rank > offset && entry.rank <= offset + limit,
    ),
    currentPlayer: null,
    currentWindow: [] as ReturnType<typeof serializeScoreRow>[],
    lastPlayer: serialized.find((entry) => entry.rank === totalPlayers) || null,
  };
}

async function queryContext(
  database: D1Database,
  key: string,
  profileId: string,
) {
  const result = await database.prepare(`
    ${RANKED_CTE},
    current_position AS (
      SELECT rank FROM ranked WHERE profile_id = ?2 LIMIT 1
    )
    SELECT *
    FROM ranked
    WHERE rank BETWEEN
      COALESCE((SELECT rank FROM current_position), -10) - 1
      AND COALESCE((SELECT rank FROM current_position), -10) + 1
    ORDER BY rank ASC
  `).bind(key, profileId).all<ScoreStatsRow>();
  const entries = (result.results || []).map(serializeScoreRow);
  const currentPlayer = entries.find((entry) => entry.profileId === profileId) || null;
  return {
    totalPlayers: result.results?.length
      ? Number(result.results[0].total_players)
      : 0,
    currentPlayer,
    currentWindow: currentPlayer && currentPlayer.rank > 3
      ? entries.filter((entry) => Math.abs(entry.rank - currentPlayer.rank) <= 1)
      : [],
  };
}

async function leaderboardResponse(
  context: Parameters<PagesFunction>[0],
  period: LeaderboardPeriod,
  live = false,
) {
  const database = requireDatabase(context.env);
  const url = new URL(context.request.url);
  const now = Date.now();
  const day = period === "daily" ? parseDay(url.searchParams.get("day"), now) : null;
  const limit = parseIntegerQuery(url.searchParams.get("limit"), 100, 1, 100, "limit");
  const offset = parseIntegerQuery(url.searchParams.get("offset"), 0, 0, 10_000, "offset");
  const key = periodKey(period, day);
  const profileId = parseProfileId(url.searchParams.get("profileId"));

  let liveRefresh: Record<string, number> | undefined;
  if (live) {
    if (!profileId) {
      throw new ApiError(400, "profile_required", "A local profile is required for live rankings.");
    }
    liveRefresh = await consumeLiveRefresh(database, key, profileId, now);
  }

  const page = await queryPage(database, key, limit, offset);
  const personal = profileId
    ? await queryContext(database, key, profileId)
    : { currentPlayer: null, currentWindow: [] };
  const payload = {
    ok: true,
    period,
    mode: "untimed",
    day,
    resetAt: period === "daily" ? nextSiteDayReset(now) : null,
    generatedAt: now,
    dataSource: "live",
    limit,
    offset,
    ...page,
    currentPlayer: personal.currentPlayer,
    currentWindow: personal.currentWindow,
    ...(liveRefresh ? { liveRefresh } : {}),
  };
  return live ? noStoreJson(payload) : cachedJson(payload, 60, 120);
}

async function consumeLiveRefresh(
  database: D1Database,
  key: string,
  profileId: string,
  now: number,
) {
  const windowDay = siteDayKey(now);
  const result = await database.prepare(`
    INSERT INTO word_score_live_refresh_limits (
      period_key, window_day, profile_id, refresh_count, last_refreshed_at
    ) VALUES (?1, ?2, ?3, 1, ?4)
    ON CONFLICT (period_key, window_day, profile_id) DO UPDATE SET
      refresh_count = word_score_live_refresh_limits.refresh_count + 1,
      last_refreshed_at = excluded.last_refreshed_at
    WHERE
      word_score_live_refresh_limits.refresh_count < ?5
      AND word_score_live_refresh_limits.last_refreshed_at <= ?6
  `).bind(
    key,
    windowDay,
    profileId,
    now,
    LIVE_REFRESH_DAILY_LIMIT,
    now - LIVE_REFRESH_COOLDOWN_MS,
  ).run();

  const row = await database.prepare(`
    SELECT refresh_count, last_refreshed_at
    FROM word_score_live_refresh_limits
    WHERE period_key = ?1 AND window_day = ?2 AND profile_id = ?3
  `).bind(key, windowDay, profileId).first<LiveRefreshRow>();
  const refreshCount = Number(row?.refresh_count || 0);
  const lastRefreshedAt = Number(row?.last_refreshed_at || 0);
  const retryAt = refreshCount >= LIVE_REFRESH_DAILY_LIMIT
    ? nextSiteDayReset(now)
    : lastRefreshedAt + LIVE_REFRESH_COOLDOWN_MS;

  if ((result.meta.changes || 0) <= 0) {
    throw new ApiError(
      429,
      refreshCount >= LIVE_REFRESH_DAILY_LIMIT
        ? "refresh_limit_reached"
        : "refresh_cooldown",
      refreshCount >= LIVE_REFRESH_DAILY_LIMIT
        ? "The daily live refresh limit has been reached."
        : "Live rankings are cooling down.",
      { refreshCount, dailyLimit: LIVE_REFRESH_DAILY_LIMIT, retryAt },
    );
  }

  return {
    refreshCount,
    dailyLimit: LIVE_REFRESH_DAILY_LIMIT,
    remaining: Math.max(0, LIVE_REFRESH_DAILY_LIMIT - refreshCount),
    retryAt,
  };
}

export const leaderboardDailyGet: PagesFunction = async (context) => {
  try {
    return await leaderboardResponse(context, "daily");
  } catch (error) {
    return errorResponse(error);
  }
};

export const leaderboardAllTimeGet: PagesFunction = async (context) => {
  try {
    return await leaderboardResponse(context, "allTime");
  } catch (error) {
    return errorResponse(error);
  }
};

export const leaderboardLiveGet: PagesFunction = async (context) => {
  try {
    const url = new URL(context.request.url);
    return await leaderboardResponse(context, parsePeriod(url.searchParams.get("period")), true);
  } catch (error) {
    return errorResponse(error);
  }
};

export const leaderboardContextGet: PagesFunction = async (context) => {
  try {
    const database = requireDatabase(context.env);
    const url = new URL(context.request.url);
    const now = Date.now();
    const period = parsePeriod(url.searchParams.get("period"));
    const profileId = parseProfileId(url.searchParams.get("profileId"));
    if (!profileId) {
      throw new ApiError(400, "profile_required", "profileId is required.");
    }
    const day = period === "daily" ? parseDay(url.searchParams.get("day"), now) : null;
    const result = await queryContext(database, periodKey(period, day), profileId);
    return cachedJson({
      ok: true,
      period,
      mode: "untimed",
      day,
      generatedAt: now,
      dataSource: "live",
      ...result,
    }, 60, 120);
  } catch (error) {
    return errorResponse(error);
  }
};

export const tickerGet: PagesFunction = async (context) => {
  try {
    const database = requireDatabase(context.env);
    const url = new URL(context.request.url);
    const now = Date.now();
    const day = siteDayKey(now);
    const limit = parseIntegerQuery(url.searchParams.get("limit"), 20, 1, 50, "limit");
    const result = await database.prepare(`
      SELECT event_id, player_nickname, score, country_code, occurred_at
      FROM word_score_events
      ORDER BY occurred_at DESC, received_at DESC, event_id DESC
      LIMIT ?1
    `).bind(limit).all<{
      event_id: string;
      player_nickname: string;
      score: number;
      country_code: string;
      occurred_at: number;
    }>();
    return cachedJson({
      ok: true,
      day,
      generatedAt: now,
      items: (result.results || []).map((row) => ({
        eventId: row.event_id,
        eventType: "live",
        player: row.player_nickname,
        opponent: `${Number(row.score).toLocaleString("en-US")} points`,
        modeLabel: "Text Twist 2 Untimed",
        tier: "live",
        achievementKey: "score_completed",
        achievementLabel: null,
        achievementValue: Number(row.score),
        countryCode: row.country_code,
        occurredAt: Number(row.occurred_at),
      })),
    }, 60, 120);
  } catch (error) {
    return errorResponse(error);
  }
};

function serializeProfileStats(row?: Partial<ScoreStatsRow>) {
  return {
    games: Number(row?.runs || 0),
    runs: Number(row?.runs || 0),
    bestScore: Number(row?.best_score || 0),
    roundsCompleted: Number(row?.best_rounds || 0),
    wordsFound: Number(row?.best_words || 0),
    longestWordLength: Number(row?.best_longest_word || 0),
    bingoWordsFound: Number(row?.best_bingo_words || 0),
    firstPlayedAt: Number(row?.best_achieved_at || 0),
    lastPlayedAt: Number(row?.last_played_at || 0),
  };
}

export const profileGet: PagesFunction = async (context) => {
  try {
    const database = requireDatabase(context.env);
    const raw = context.params.profileId;
    const profileId = parseProfileId(Array.isArray(raw) ? raw[0] : raw || null);
    if (!profileId) throw new ApiError(400, "invalid_profile_id", "profileId is required.");
    const url = new URL(context.request.url);
    const now = Date.now();
    const day = parseDay(url.searchParams.get("day"), now);
    const results = await database.batch([
      database.prepare(`
        SELECT * FROM word_score_player_stats
        WHERE period_key = ?1 AND profile_id = ?2
      `).bind(ALL_TIME_PERIOD_KEY, profileId),
      database.prepare(`
        SELECT * FROM word_score_player_stats
        WHERE period_key = ?1 AND profile_id = ?2
      `).bind(day, profileId),
      database.prepare(`
        ${RANKED_CTE}
        SELECT rank FROM ranked WHERE profile_id = ?2
      `).bind(day, profileId),
    ]);
    const allTime = results[0]?.results?.[0] as unknown as ScoreStatsRow | undefined;
    if (!allTime) throw new ApiError(404, "profile_not_found", "No score events were found.");
    const daily = results[1]?.results?.[0] as unknown as ScoreStatsRow | undefined;
    const rank = results[2]?.results?.[0] as unknown as { rank: number } | undefined;
    return cachedJson({
      ok: true,
      profileId,
      nickname: allTime.nickname,
      countryCode: allTime.country_code,
      day,
      dailyRank: rank ? Number(rank.rank) : null,
      daily: serializeProfileStats(daily),
      allTime: serializeProfileStats(allTime),
      generatedAt: now,
    });
  } catch (error) {
    return errorResponse(error);
  }
};

function scoreSortKey(event: NormalizedScoreEvent) {
  const reverseTime = Number.MAX_SAFE_INTEGER - event.occurredAt;
  return [
    String(event.score).padStart(9, "0"),
    String(event.roundsCompleted).padStart(5, "0"),
    String(event.wordsFound).padStart(6, "0"),
    String(event.bingoWordsFound).padStart(5, "0"),
    String(event.longestWordLength).padStart(2, "0"),
    String(reverseTime).padStart(16, "0"),
  ].join(":");
}

const UPSERT_STATS_SQL = `
  INSERT INTO word_score_player_stats (
    period_key, profile_id, nickname, country_code, runs,
    best_score, best_rounds, best_words, best_longest_word,
    best_bingo_words, best_achieved_at, best_sort_key, last_played_at
  ) VALUES (?1, ?2, ?3, ?4, 1, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?10)
  ON CONFLICT (period_key, profile_id) DO UPDATE SET
    nickname = excluded.nickname,
    country_code = excluded.country_code,
    runs = word_score_player_stats.runs + 1,
    best_score = CASE WHEN excluded.best_sort_key > word_score_player_stats.best_sort_key
      THEN excluded.best_score ELSE word_score_player_stats.best_score END,
    best_rounds = CASE WHEN excluded.best_sort_key > word_score_player_stats.best_sort_key
      THEN excluded.best_rounds ELSE word_score_player_stats.best_rounds END,
    best_words = CASE WHEN excluded.best_sort_key > word_score_player_stats.best_sort_key
      THEN excluded.best_words ELSE word_score_player_stats.best_words END,
    best_longest_word = CASE WHEN excluded.best_sort_key > word_score_player_stats.best_sort_key
      THEN excluded.best_longest_word ELSE word_score_player_stats.best_longest_word END,
    best_bingo_words = CASE WHEN excluded.best_sort_key > word_score_player_stats.best_sort_key
      THEN excluded.best_bingo_words ELSE word_score_player_stats.best_bingo_words END,
    best_achieved_at = CASE WHEN excluded.best_sort_key > word_score_player_stats.best_sort_key
      THEN excluded.best_achieved_at ELSE word_score_player_stats.best_achieved_at END,
    best_sort_key = MAX(word_score_player_stats.best_sort_key, excluded.best_sort_key),
    last_played_at = MAX(word_score_player_stats.last_played_at, excluded.last_played_at)
`;

function statsStatement(
  database: D1Database,
  period: string,
  event: NormalizedScoreEvent,
  countryCode: string,
) {
  return database.prepare(UPSERT_STATS_SQL).bind(
    period,
    event.profileId,
    event.playerNickname,
    countryCode,
    event.score,
    event.roundsCompleted,
    event.wordsFound,
    event.longestWordLength,
    event.bingoWordsFound,
    event.occurredAt,
    scoreSortKey(event),
  );
}

export const matchesBatchPost: PagesFunction = async (context) => {
  try {
    const database = requireDatabase(context.env);
    const body = await readJsonBody(context.request);
    const now = Date.now();
    const countryCode = countryCodeFromRequest(context.request);
    const events = normalizeScoreBatch(body, now);
    const inserts = events.map((event) => database.prepare(`
      INSERT OR IGNORE INTO word_score_events (
        event_id, run_id, schema_version, game_id, profile_id,
        player_nickname, mode_key, score, rounds_completed, words_found,
        longest_word_length, bingo_words_found, occurred_at, received_at,
        day_key, country_code, client_game_version, client_profile_revision
      ) VALUES (
        ?1, ?2, 1, 'text-twist-2-untimed', ?3, ?4, 'untimed', ?5,
        ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15
      )
    `).bind(
      event.eventId,
      event.runId,
      event.profileId,
      event.playerNickname,
      event.score,
      event.roundsCompleted,
      event.wordsFound,
      event.longestWordLength,
      event.bingoWordsFound,
      event.occurredAt,
      now,
      siteDayKey(event.occurredAt),
      countryCode,
      event.gameVersion,
      event.profileRevision,
    ));
    const insertResults = await database.batch(inserts);
    const inserted = events.filter(
      (_, index) => Number(insertResults[index]?.meta?.changes || 0) > 0,
    );
    if (inserted.length) {
      await database.batch(inserted.flatMap((event) => [
        statsStatement(database, siteDayKey(event.occurredAt), event, countryCode),
        statsStatement(database, ALL_TIME_PERIOD_KEY, event, countryCode),
      ]));
    }
    const insertedIds = new Set(inserted.map((event) => event.eventId));
    return noStoreJson({
      ok: true,
      acknowledgedEventIds: events.map((event) => event.eventId),
      insertedEventIds: Array.from(insertedIds),
      duplicateEventIds: events
        .filter((event) => !insertedIds.has(event.eventId))
        .map((event) => event.eventId),
      receivedAt: now,
      day: siteDayKey(now),
    });
  } catch (error) {
    return errorResponse(error);
  }
};
