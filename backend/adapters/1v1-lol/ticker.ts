import { requireDatabase } from "../../core/database";
import {
  cachedJson,
  errorResponse,
  optionsResponse,
  parseIntegerQuery,
  siteDayKey
} from "../../core/http";

interface TickerRow {
  feed_event_id: string;
  event_type: "live" | "streak" | "arena";
  player_nickname: string;
  opponent_nickname: string | null;
  mode_label: string | null;
  tier_key: "live" | "silver" | "green" | "blue" | "purple" | "gold";
  achievement_key: string | null;
  achievement_label: string | null;
  achievement_value: number | null;
  country_code: string;
  occurred_at: number;
}

export const onRequestOptions: PagesFunction = async () => optionsResponse();

export const onRequestGet: PagesFunction = async (context) => {
  try {
    const database = requireDatabase(context.env);
    const url = new URL(context.request.url);
    const now = Date.now();
    const day = siteDayKey(now);
    const limit = parseIntegerQuery(
      url.searchParams.get("limit"),
      20,
      1,
      50,
      "limit"
    );

    const result = await database.prepare(`
      SELECT
        feed_event_id,
        event_type,
        player_nickname,
        opponent_nickname,
        mode_label,
        tier_key,
        achievement_key,
        achievement_label,
        achievement_value,
        country_code,
        occurred_at
      FROM feed_events
      ORDER BY occurred_at DESC, created_at DESC, priority DESC, feed_event_id DESC
      LIMIT ?1
    `).bind(limit).all<TickerRow>();

    return cachedJson({
      ok: true,
      day,
      generatedAt: now,
      items: (result.results || []).map((row) => ({
        eventId: row.feed_event_id,
        eventType: row.event_type,
        player: row.player_nickname,
        opponent: row.opponent_nickname,
        modeLabel: row.mode_label,
        tier: row.tier_key,
        achievementKey: row.achievement_key,
        achievementLabel: row.achievement_label,
        achievementValue: row.achievement_value === null
          ? null
          : Number(row.achievement_value),
        countryCode: row.country_code,
        occurredAt: Number(row.occurred_at)
      }))
    }, 10, 20);
  } catch (error) {
    return errorResponse(error);
  }
};
