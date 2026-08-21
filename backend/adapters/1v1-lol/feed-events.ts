import { NormalizedMatchEvent } from "./match-event";
import { siteDayKey } from "../../../lib/site-time";

type FeedEventType = "streak" | "arena";
type FeedTier = "silver" | "green" | "blue" | "purple" | "gold";

interface MilestoneDefinition {
  level: number;
  value: number;
  key: string;
  label: string;
  tier: FeedTier;
}

interface DailyFeedStateRow {
  rank: number;
  total_players: number;
  best_win_streak: number;
  streak_level: number;
  arena_level: number;
}

interface DailyPlayerFeedStateRow {
  best_win_streak: number;
  streak_level: number;
  arena_level: number;
}

interface DailyTopPlayerRow {
  profile_id: string;
}

interface PreviousEncounterRow {
  result: "win" | "loss";
}

const MINIMUM_ARENA_PLAYERS = 10;
const REVENGE_LOOKBACK_MS = 24 * 60 * 60 * 1000;

const STREAK_MILESTONES: MilestoneDefinition[] = [
  { level: 1, value: 3, key: "rising_star", label: "Rising Star", tier: "silver" },
  { level: 2, value: 5, key: "unstoppable", label: "Unstoppable", tier: "green" },
  { level: 3, value: 10, key: "rampage", label: "Rampage", tier: "blue" },
  { level: 4, value: 15, key: "legendary", label: "Legendary", tier: "purple" },
  { level: 5, value: 20, key: "invincible", label: "Invincible", tier: "gold" }
];

const ARENA_MILESTONES: MilestoneDefinition[] = [
  {
    level: 1,
    value: 10,
    key: "rising_challenger",
    label: "Rising Challenger",
    tier: "green"
  },
  {
    level: 2,
    value: 5,
    key: "elite_challenger",
    label: "Elite Challenger",
    tier: "blue"
  },
  {
    level: 3,
    value: 3,
    key: "epic_challenger",
    label: "Epic Challenger",
    tier: "purple"
  },
  {
    level: 4,
    value: 1,
    key: "legendary_challenger",
    label: "Legendary Challenger",
    tier: "gold"
  }
];

function highestReached(
  milestones: MilestoneDefinition[],
  predicate: (milestone: MilestoneDefinition) => boolean
) {
  return [...milestones].reverse().find(predicate) || null;
}

async function findRevengeEventIds(
  database: D1Database,
  events: NormalizedMatchEvent[]
) {
  const candidates = events.filter(
    (event) => event.opponentNetworkUserId && event.opponentNickname
  );
  if (!candidates.length) return new Set<string>();

  const results = await database.batch(
    candidates.map((event) =>
      database.prepare(`
        SELECT result
        FROM match_events
        WHERE
          profile_id = ?1
          AND opponent_network_user_id = ?2
          AND opponent_network_user_id IS NOT NULL
          AND mode_key = '1v1'
          AND occurred_at >= ?3
          AND (
            occurred_at < ?4
            OR (occurred_at = ?4 AND event_id < ?5)
          )
        ORDER BY occurred_at DESC, event_id DESC
        LIMIT 1
      `).bind(
        event.profileId,
        event.opponentNetworkUserId,
        Math.max(0, event.occurredAt - REVENGE_LOOKBACK_MS),
        event.occurredAt,
        event.eventId
      )
    )
  );

  const revengeEventIds = new Set<string>();
  candidates.forEach((event, index) => {
    const previous = results[index]?.results?.[0] as
      | PreviousEncounterRow
      | undefined;
    if (previous?.result === "loss") revengeEventIds.add(event.eventId);
  });
  return revengeEventIds;
}

async function queryDailyFeedState(
  database: D1Database,
  dayKey: string,
  profileId: string
) {
  const [playerStateResult, topPlayersResult] = await database.batch([
    database.prepare(`
      SELECT
        stats.best_win_streak,
        COALESCE(MAX(CASE
          WHEN milestones.milestone_type = 'streak'
          THEN milestones.tier_level
          ELSE 0
        END), 0) AS streak_level,
        COALESCE(MAX(CASE
          WHEN milestones.milestone_type = 'arena'
          THEN milestones.tier_level
          ELSE 0
        END), 0) AS arena_level
      FROM leaderboard_player_stats AS stats
      LEFT JOIN daily_player_milestones AS milestones
        ON milestones.day_key = stats.period_key
        AND milestones.profile_id = stats.profile_id
      WHERE stats.period_key = ?1 AND stats.profile_id = ?2
      GROUP BY stats.profile_id, stats.best_win_streak
    `).bind(dayKey, profileId),
    database.prepare(`
      SELECT profile_id
      FROM leaderboard_player_stats
      WHERE period_key = ?1
      ORDER BY
        wins DESC,
        win_rate_tenths DESC,
        kills DESC,
        games ASC,
        last_played_at ASC,
        profile_id ASC
      LIMIT 10
    `).bind(dayKey)
  ]);

  const playerState = playerStateResult.results?.[0] as
    | DailyPlayerFeedStateRow
    | undefined;
  if (!playerState) return null;

  const topPlayers = (topPlayersResult.results || []) as unknown as
    DailyTopPlayerRow[];
  const topPlayerIndex = topPlayers.findIndex(
    (row) => row.profile_id === profileId
  );

  return {
    rank: topPlayerIndex >= 0 ? topPlayerIndex + 1 : 11,
    total_players: topPlayers.length,
    best_win_streak: Number(playerState.best_win_streak),
    streak_level: Number(playerState.streak_level),
    arena_level: Number(playerState.arena_level)
  } satisfies DailyFeedStateRow;
}

function milestoneStatements(
  database: D1Database,
  options: {
    type: FeedEventType;
    definitions: MilestoneDefinition[];
    reached: MilestoneDefinition;
    currentLevel: number;
    event: NormalizedMatchEvent;
    dayKey: string;
    countryCode: string;
    createdAt: number;
  }
) {
  const {
    type,
    definitions,
    reached,
    currentLevel,
    event,
    dayKey,
    countryCode,
    createdAt
  } = options;
  const statements = definitions
    .filter(
      (milestone) =>
        milestone.level > currentLevel && milestone.level <= reached.level
    )
    .map((milestone) =>
      database.prepare(`
        INSERT OR IGNORE INTO daily_player_milestones (
          day_key,
          profile_id,
          milestone_type,
          tier_level,
          milestone_value,
          source_event_id,
          achieved_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
      `).bind(
        dayKey,
        event.profileId,
        type,
        milestone.level,
        milestone.value,
        event.eventId,
        createdAt
      )
    );

  statements.push(
    database.prepare(`
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
        ?1, ?2, ?3, ?4, ?5, ?6, NULL, NULL, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14
      WHERE EXISTS (
        SELECT 1
        FROM daily_player_milestones
        WHERE
          day_key = ?4
          AND profile_id = ?5
          AND milestone_type = ?3
          AND tier_level = ?15
          AND source_event_id = ?2
      )
    `).bind(
      `${type}:${dayKey}:${event.profileId}:${reached.level}`,
      event.eventId,
      type,
      dayKey,
      event.profileId,
      event.playerNickname,
      reached.tier,
      reached.key,
      reached.label,
      reached.value,
      countryCode,
      event.occurredAt,
      createdAt,
      type === "arena" ? 3 : 2,
      reached.level
    )
  );
  return statements;
}

export async function generateDailyFeedEvents(
  database: D1Database,
  events: NormalizedMatchEvent[],
  todayKey: string,
  countryCode: string,
  createdAt: number
) {
  const todayWins = events.filter(
    (event) =>
      event.result === "win" &&
      siteDayKey(event.occurredAt) === todayKey
  );
  if (!todayWins.length) return;

  const revengeEventIds = await findRevengeEventIds(database, todayWins);

  const liveStatements = todayWins
    .filter((event) => Boolean(event.opponentNickname))
    .map((event) =>
      database.prepare(`
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
        ) VALUES (
          ?1, ?2, 'live', ?3, ?4, ?5, ?6, ?7, 'live',
          ?8, ?9, NULL, ?10, ?11, ?12, 1
        )
      `).bind(
        `live:${event.eventId}`,
        event.eventId,
        todayKey,
        event.profileId,
        event.playerNickname,
        event.opponentNickname,
        event.isCompetitive ? "1v1 Competitive" : "1v1 Casual",
        revengeEventIds.has(event.eventId) ? "sweet_revenge" : null,
        revengeEventIds.has(event.eventId) ? "Sweet revenge!" : null,
        countryCode,
        event.occurredAt,
        createdAt
      )
    );
  if (liveStatements.length) await database.batch(liveStatements);

  const latestWinByProfile = new Map<string, NormalizedMatchEvent>();
  for (const event of todayWins) {
    const previous = latestWinByProfile.get(event.profileId);
    if (
      !previous ||
      event.occurredAt > previous.occurredAt ||
      (event.occurredAt === previous.occurredAt &&
        event.eventId > previous.eventId)
    ) {
      latestWinByProfile.set(event.profileId, event);
    }
  }

  for (const event of Array.from(latestWinByProfile.values())) {
    const state = await queryDailyFeedState(
      database,
      todayKey,
      event.profileId
    );
    if (!state) continue;

    const statements: D1PreparedStatement[] = [];
    const streak = highestReached(
      STREAK_MILESTONES,
      (milestone) =>
        Number(state.best_win_streak) >= milestone.value &&
        milestone.level > Number(state.streak_level)
    );
    if (streak) {
      statements.push(...milestoneStatements(database, {
        type: "streak",
        definitions: STREAK_MILESTONES,
        reached: streak,
        currentLevel: Number(state.streak_level),
        event,
        dayKey: todayKey,
        countryCode,
        createdAt
      }));
    }

    const arena = Number(state.total_players) >= MINIMUM_ARENA_PLAYERS
      ? highestReached(
          ARENA_MILESTONES,
          (milestone) =>
            Number(state.rank) <= milestone.value &&
            milestone.level > Number(state.arena_level)
        )
      : null;
    if (arena) {
      statements.push(...milestoneStatements(database, {
        type: "arena",
        definitions: ARENA_MILESTONES,
        reached: arena,
        currentLevel: Number(state.arena_level),
        event,
        dayKey: todayKey,
        countryCode,
        createdAt
      }));
    }

    if (statements.length) await database.batch(statements);
  }
}
