import { requireDatabase } from "../../core/database";
import {
  ApiError,
  cachedJson,
  errorResponse,
  optionsResponse,
  parseDay
} from "../../core/http";

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface AggregateRow {
  games: number;
  wins: number;
  losses: number;
  kills: number;
  deaths: number;
  win_rate: number;
  first_played_at: number;
  last_played_at: number;
  nickname: string;
  country_code: string;
}

interface RankRow {
  rank: number;
}

interface StreakRow {
  current_win_streak: number;
}

export const onRequestOptions: PagesFunction = async () => optionsResponse();

export const onRequestGet: PagesFunction = async (context) => {
  try {
    const database = requireDatabase(context.env);
    const rawProfileId = context.params.profileId;
    const profileId = (
      Array.isArray(rawProfileId) ? rawProfileId[0] : rawProfileId
    )?.toLowerCase();
    if (!profileId || !UUID_V4.test(profileId)) {
      throw new ApiError(400, "invalid_profile_id", "profileId must be a UUID v4.");
    }

    const url = new URL(context.request.url);
    const now = Date.now();
    const day = parseDay(url.searchParams.get("day"), now);
    const aggregateSql = `
      SELECT
        COUNT(*) AS games,
        SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) AS wins,
        SUM(CASE WHEN result = 'loss' THEN 1 ELSE 0 END) AS losses,
        SUM(kills) AS kills,
        SUM(deaths) AS deaths,
        ROUND(
          100.0 * SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) / COUNT(*),
          1
        ) AS win_rate,
        MIN(received_at) AS first_played_at,
        MAX(received_at) AS last_played_at,
        (
          SELECT player_nickname
          FROM match_events latest
          WHERE latest.profile_id = ?1
          ORDER BY received_at DESC, event_id DESC
          LIMIT 1
        ) AS nickname,
        (
          SELECT country_code
          FROM match_events latest
          WHERE latest.profile_id = ?1
          ORDER BY received_at DESC, event_id DESC
          LIMIT 1
        ) AS country_code
      FROM match_events
      WHERE profile_id = ?1
    `;
    const dailyAggregateSql = `
      SELECT
        COUNT(*) AS games,
        SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) AS wins,
        SUM(CASE WHEN result = 'loss' THEN 1 ELSE 0 END) AS losses,
        SUM(kills) AS kills,
        SUM(deaths) AS deaths,
        ROUND(
          100.0 * SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) / COUNT(*),
          1
        ) AS win_rate,
        MIN(received_at) AS first_played_at,
        MAX(received_at) AS last_played_at,
        (
          SELECT player_nickname
          FROM match_events latest
          WHERE latest.profile_id = ?1
          ORDER BY received_at DESC, event_id DESC
          LIMIT 1
        ) AS nickname,
        (
          SELECT country_code
          FROM match_events latest
          WHERE latest.profile_id = ?1
          ORDER BY received_at DESC, event_id DESC
          LIMIT 1
        ) AS country_code
      FROM match_events
      WHERE profile_id = ?1 AND day_key = ?2 AND mode_key = '1v1'
    `;
    const rankSql = `
      WITH aggregates AS (
        SELECT
          profile_id,
          COUNT(*) AS games,
          SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) AS wins,
          SUM(kills) AS kills,
          ROUND(
            100.0 * SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) / COUNT(*),
            1
          ) AS win_rate,
          MAX(received_at) AS last_played_at
        FROM match_events
        WHERE day_key = ?1 AND mode_key = '1v1'
        GROUP BY profile_id
      ),
      ranked AS (
        SELECT
          profile_id,
          ROW_NUMBER() OVER (
            ORDER BY
              wins DESC,
              win_rate DESC,
              kills DESC,
              games ASC,
              last_played_at ASC,
              profile_id ASC
          ) AS rank
        FROM aggregates
      )
      SELECT rank FROM ranked WHERE profile_id = ?2
    `;
    const streakSql = `
      WITH ordered AS (
        SELECT
          result,
          SUM(CASE WHEN result = 'loss' THEN 1 ELSE 0 END) OVER (
            ORDER BY occurred_at, event_id
          ) AS loss_group
        FROM match_events
        WHERE profile_id = ?1 AND mode_key = '1v1'
      ),
      latest_group AS (
        SELECT COALESCE(MAX(loss_group), 0) AS loss_group
        FROM ordered
      )
      SELECT COUNT(*) AS current_win_streak
      FROM ordered
      CROSS JOIN latest_group
      WHERE
        ordered.result = 'win'
        AND ordered.loss_group = latest_group.loss_group
    `;

    const results = await database.batch([
      database.prepare(aggregateSql).bind(profileId),
      database.prepare(dailyAggregateSql).bind(profileId, day),
      database.prepare(rankSql).bind(day, profileId),
      database.prepare(streakSql).bind(profileId)
    ]);

    const allTime = results[0]?.results?.[0] as unknown as AggregateRow | undefined;
    if (!allTime || Number(allTime.games) === 0) {
      throw new ApiError(404, "profile_not_found", "No match events were found.");
    }
    const daily = results[1]?.results?.[0] as unknown as AggregateRow | undefined;
    const rank = results[2]?.results?.[0] as unknown as RankRow | undefined;
    const streak = results[3]?.results?.[0] as unknown as StreakRow | undefined;

    const serializeAggregate = (row: AggregateRow | undefined) => ({
      games: Number(row?.games || 0),
      wins: Number(row?.wins || 0),
      losses: Number(row?.losses || 0),
      kills: Number(row?.kills || 0),
      deaths: Number(row?.deaths || 0),
      winRate: Number(row?.win_rate || 0),
      firstPlayedAt: Number(row?.first_played_at || 0),
      lastPlayedAt: Number(row?.last_played_at || 0)
    });

    return cachedJson({
      ok: true,
      profileId,
      nickname: allTime.nickname,
      countryCode: allTime.country_code,
      day,
      dailyRank: rank ? Number(rank.rank) : null,
      currentWinStreak: Number(streak?.current_win_streak || 0),
      daily: serializeAggregate(daily),
      allTime: serializeAggregate(allTime),
      generatedAt: now
    });
  } catch (error) {
    return errorResponse(error);
  }
};
