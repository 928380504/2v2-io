// Install inside an authorized game build. Replace both constants per site.
const PARENT_ORIGIN = "https://example.com";
const GAME_SOURCE = "example-site-game";
const SITE_SOURCE = "example-site-site";
const SCHEMA_VERSION = 1;

const outbox = new Map();

function publishProfile(profile) {
  window.parent.postMessage({
    source: GAME_SOURCE,
    schemaVersion: SCHEMA_VERSION,
    type: "profile.ready",
    profile,
  }, PARENT_ORIGIN);
}

function publishPending(profileId) {
  const events = Array.from(outbox.values()).slice(0, 20);
  if (!events.length) return;
  window.parent.postMessage({
    source: GAME_SOURCE,
    schemaVersion: SCHEMA_VERSION,
    type: "matches.pending",
    profileId,
    events,
  }, PARENT_ORIGIN);
}

// Call once when a run is definitively finished, not after every found word.
function queueCompletedWordRun(profile, run) {
  const event = {
    schemaVersion: 1,
    eventId: crypto.randomUUID(),
    eventType: "score.completed",
    gameId: "text-twist-2-untimed",
    profileId: profile.profileId,
    runId: run.runId,
    player: {
      profileId: profile.profileId,
      nickname: profile.nickname,
    },
    score: {
      modeKey: "untimed",
      value: run.score,
      roundsCompleted: run.roundsCompleted,
      wordsFound: run.wordsFound,
      longestWordLength: run.longestWordLength,
      bingoWordsFound: run.bingoWordsFound,
    },
    occurredAt: Date.now(),
    client: {
      gameVersion: run.gameVersion,
      profileRevision: profile.revision,
    },
  };
  outbox.set(event.eventId, event);
  publishProfile(profile);
  publishPending(profile.profileId);
}

window.addEventListener("message", (event) => {
  if (event.origin !== PARENT_ORIGIN || event.source !== window.parent) return;
  const message = event.data;
  if (!message || message.source !== SITE_SOURCE ||
      message.schemaVersion !== SCHEMA_VERSION) return;

  if (message.type === "bridge.request") {
    const profile = window.getLocalCompetitionProfile?.();
    if (profile) {
      publishProfile(profile);
      publishPending(profile.profileId);
    }
  }

  if (message.type === "matches.ack" && Array.isArray(message.acknowledgedEventIds)) {
    message.acknowledgedEventIds.forEach((eventId) => outbox.delete(eventId));
  }
});

window.queueCompletedWordRun = queueCompletedWordRun;

