import { countryCodeFromRequest, requireDatabase } from "../../core/database";
import {
  errorResponse,
  noStoreJson,
  optionsResponse,
  readJsonBody,
  siteDayKey
} from "../../core/http";
import { generateDailyFeedEvents } from "./feed-events";
import { normalizeEventBatch } from "./match-event";

export const onRequestOptions: PagesFunction = async () => optionsResponse();

export const onRequestPost: PagesFunction = async (context) => {
  try {
    const database = requireDatabase(context.env);
    const body = await readJsonBody(context.request);
    const now = Date.now();
    const todayKey = siteDayKey(now);
    const countryCode = countryCodeFromRequest(context.request);
    const events = normalizeEventBatch(body, now);

    const statements = events.map((event) =>
      database.prepare(`
        INSERT OR IGNORE INTO match_events (
          event_id,
          schema_version,
          game_id,
          profile_id,
          player_network_user_id,
          player_nickname,
          opponent_network_user_id,
          opponent_nickname,
          opponent_actor_id,
          mode_key,
          result,
          kills,
          deaths,
          is_competitive,
          rank_type,
          occurred_at,
          received_at,
          day_key,
          country_code,
          client_game_version,
          client_profile_revision
        ) VALUES (
          ?1, 3, '1v1-lol', ?2, ?3, ?4, ?5, ?6, ?7, '1v1', ?8,
          ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18
        )
      `).bind(
        event.eventId,
        event.profileId,
        event.playerNetworkUserId,
        event.playerNickname,
        event.opponentNetworkUserId,
        event.opponentNickname,
        event.opponentActorId,
        event.result,
        event.kills,
        event.deaths,
        event.isCompetitive ? 1 : 0,
        event.rankType,
        event.occurredAt,
        now,
        siteDayKey(event.occurredAt),
        countryCode,
        event.gameVersion,
        event.profileRevision
      )
    );

    const results = await database.batch(statements);
    const insertedEvents = events.filter(
      (_, index) => (results[index]?.meta?.changes || 0) > 0
    );
    const insertedEventIds = insertedEvents.map((event) => event.eventId);
    const insertedEventIdSet = new Set(insertedEventIds);

    await generateDailyFeedEvents(
      database,
      insertedEvents,
      todayKey,
      countryCode,
      now
    );

    return noStoreJson({
      ok: true,
      acknowledgedEventIds: events.map((event) => event.eventId),
      insertedEventIds,
      duplicateEventIds: events
        .filter((event) => !insertedEventIdSet.has(event.eventId))
        .map((event) => event.eventId),
      receivedAt: now,
      day: todayKey
    });
  } catch (error) {
    return errorResponse(error);
  }
};
