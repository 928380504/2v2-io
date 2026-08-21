# 1v1.LOL Pages Functions API

`functions/api` is now a compatibility layer that preserves the public routes
listed below. Reusable handlers live in `backend/community`; match, profile,
feed and leaderboard handlers live in `backend/adapters/1v1-lol`. The selected
adapter and D1 binding are configured in `site/backend.ts`.

These routes are deployed by Cloudflare Pages Functions:

- `GET /api/health`
- `POST /api/matches/batch`
- `GET /api/leaderboard/daily`
- `GET /api/leaderboard/all-time`
- `GET /api/leaderboard/live`
- `GET /api/ticker`
- `GET /api/profile/:profileId`
- `GET /api/comments`
- `GET /api/comments/ratings?gameIds=1v1-lol,2v2-io,...`
- `POST /api/comments`
- `POST /api/comments/:commentId/reaction`
- `GET /api/games/:gameId/engagement?visitorId=...`
- `POST /api/games/:gameId/engagement`
- `GET /api/games/cards?gameIds=1v1-lol,2v2-io,...`

## Required Cloudflare binding

Create one D1 database for this site and bind it to the Pages project with the
variable name `DB`. Configure the same binding for Preview if preview
deployments should use a separate test database.

The binding can be added in Cloudflare under **Workers & Pages > project >
Settings > Bindings > Add > D1**. Keep the same name in `site/backend.ts` and
`site/cloudflare.json`; the deployment audit reports any mismatch.

## Apply the schema

`site/competition-migrations.json` classifies every immutable SQL file into the shared
`community` group or one competition-adapter group. To print the correctly
ordered plan for the adapter selected by this site, run:

```text
npm run migrations:list
```

The files themselves deliberately remain at their original paths and numbers.
Never move, rename, or edit a migration that has already been applied online.

The initial schema is stored in:

```text
migrations/0001_match_events.sql
migrations/0002_daily_feed_events.sql
migrations/0003_daily_podium.sql
migrations/0004_revenge_lookup.sql
migrations/0005_comments.sql
migrations/0006_game_engagement.sql
migrations/0007_leaderboard_stats.sql
migrations/0008_game_vote_limits.sql
migrations/0009_leaderboard_rank_snapshots.sql
migrations/0010_leaderboard_previous_day_wins.sql
```

Every website must receive a newly created, site-exclusive D1 database. Apply
the selected files through the tracked deployment workflow before sending
traffic to the API:

```text
npm run cloudflare:check
npm run cloudflare:provision
npm run cloudflare:provision -- --apply --confirm <site/database/create>
npm run cloudflare:migrations -- --remote
npm run cloudflare:migrations -- --remote --apply --confirm <site/database>
```

Do not execute these files with raw `d1 execute`: that bypasses Wrangler's
tracking table and makes later schema updates ambiguous. The same migration
files remain useful after launch—new template versions append a new numbered
file, and Wrangler applies only files not already recorded for this site.

The confirmed Pages deployment is launched from the generated Wrangler
workspace. Its configuration includes the site's D1 binding, so a separate
dashboard binding step is unnecessary. Redeploy after changing a binding.

## Game engagement

- `play` is counted when the visitor intentionally starts a game. The same
  visitor and game can add one play every 30 minutes; page views, iframe resets,
  and fullscreen changes do not count.
- Engagement snapshots are cached in browser `localStorage` for 15 minutes.
  Cached values render immediately, and a known 30-minute play cooldown is
  enforced in the browser before any duplicate play request reaches the API.
- Every `like`, `dislike`, or `favorite` click increments its public counter
  once. These counters measure clicks rather than unique visitors and do not
  support server-side cancellation.
- The Favorites drawer remains a browser-local add/remove list; removing an
  item locally does not subtract from the historical public click counter.
- Counter clicks use one atomic aggregate-table statement and do not create
  per-visitor reaction or favorite rows.
- Engagement counters start at zero. Legacy values in `config/game-catalog-data.ts` are not
  written into D1 or presented as real user activity.
- Game listing cards load plays, likes, and favorites in one batch request.
  Ratings continue to use the existing batched ratings endpoint. Responses are
  cached at the edge for five minutes and in the browser for fifteen minutes.

## Public comments

- The browser creates one anonymous UUID in `localStorage` and sends it with
  comment and reaction requests. No login or identity initialization endpoint
  is required.
- Root comments require a rating from 1 to 5. Replies reference `parentId` and
  do not carry a rating.
- A visitor can publish at most three root comments or replies per site day
  across the site.
- Comment text is checked in both the browser and Pages Function. Links,
  repeated content, excessive capitalization, obvious flooding, and blocked
  abusive terms are rejected.
- Reactions are unique per visitor and comment. Selecting the same reaction
  again removes it; selecting the other reaction switches it.
- Comment rating totals are maintained in `comment_game_stats` so list reads do
  not need to scan every historical comment.
- The ratings route accepts up to 50 unique game IDs and returns all aggregated
  scores in one cached response. Legacy seeds in `config/game-catalog-data.ts` are used only
  when accompanied by a seed vote count.
- Public scores use a global Bayesian prior equivalent to 50 five-star ratings:
  `(real rating sum + 250) / (real votes + 50)`.
- D1 continues to store only real user ratings. Visible vote totals and SEO
  `AggregateRating.ratingCount` expose `real votes + 50`, while the build-time
  snapshot makes the same weighted score and count available in static HTML.

## Identity rules

- `profileId` is the stable browser-local leaderboard identity.
- `networkUserId` is a Photon connection identity and must not be used as the
  permanent leaderboard key.
- `eventId` is the idempotency key. A duplicate event is acknowledged without
  inserting or counting it twice.
- Country is read from Cloudflare request metadata. Client-supplied country
  values are ignored.
- The site business time zone is configured once in `config/site-time.ts`.
  Daily features currently use `America/New_York` and reset at local `00:00`.
- Match events are assigned to a site day from their trusted, bounded
  `occurredAt` timestamp.
- Daily podiums finalize at local `00:00` when the previous site day closes.
- The first Daily or All-time leaderboard request after the site-day reset
  finalizes yesterday's podium before returning medal totals.
- Podium history is stored by `profileId`; nickname changes do not remove medals.
- Yesterday's podium is carried into the new Daily board with zeroed match
  statistics. Any player with a win today ranks above these zero-win entries.
- Until finalization succeeds, carry-over rows can fall back to yesterday's
  provisional ranking; the finalized podium replaces it immediately.
- Daily entries expose `previousDayRank` and `previousDayWins`; all-time entries expose cumulative
  `medals.gold`, `medals.silver`, `medals.bronze`, and `medals.total` counts.
- An All-time snapshot created before the current local `00:00` boundary is
  rebuilt synchronously after podium finalization. Edge and browser caches are
  prevented from carrying the previous day's medal totals across that boundary.

## Daily activity feed

`POST /api/matches/batch` derives activity from accepted match events. The game
client does not submit streak, rank, or achievement values.

- `LIVE` records a real 1v1 win with a known opponent.
- A `LIVE` win is labeled `Sweet revenge!` when the player's most recent match
  against the same network opponent within 24 hours was a loss. A second win is
  ordinary unless that opponent defeats the player again first.
- `STREAK` records the highest newly reached daily streak tier at 3, 5, 10, 15,
  or 20 wins.
- `ARENA` records the highest newly reached Daily Top 10, Top 5, Top 3, or #1
  tier once at least 10 players have joined the daily leaderboard.
- Each streak and arena tier is emitted at most once per profile per site day.
- Duplicate match uploads safely repair missing feed events without emitting
  duplicates.

Leaderboard reads use incrementally maintained daily and all-time player
summaries instead of rebuilding every player's totals from historical matches.
Normal Daily and All-time requests read versioned rank snapshots: Daily snapshots
refresh every three hours and All-time snapshots every 24 hours. The previous
snapshot stays active while a replacement is built. `/api/leaderboard/context`
reads the requested player's previous, current, and next positions from the same
snapshot. `/api/leaderboard/live` performs one real-time ranking query for an
eligible player and returns both the Top 100 and the player's context. Live
refreshes are limited to once every five minutes and 12 times per profile,
period, and site day.

## Upload response

`acknowledgedEventIds` contains every valid event that the server has safely
accepted, including events that already existed. The iframe should delete only
those IDs from its local pending queue.
