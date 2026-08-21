# Text Twist 2 Untimed competition adapter example

This example shows how the template's win-based competition adapter can be
replaced by a score-based adapter for an untimed word game.

The reference page embeds a canvas game from another origin. Its visible score
is painted into canvas and the inspected build does not expose a verified score
API or `postMessage` contract. Do not scrape canvas pixels or trust DOM text.
The game build must explicitly publish a final, structured score event.

## Ranking model

- Daily and all-time boards rank each profile by its **best completed run**.
- More sessions do not add together, so replay volume cannot inflate score.
- Ties use rounds, words, bingo words, longest word, earliest achievement time,
  and finally profile ID.
- Elapsed time is deliberately excluded because the reference mode is Untimed.
- Only aggregate numbers are uploaded. Guessed words and puzzle contents are
  not stored.
- Client-submitted scores are suitable for a casual community leaderboard.
  A prize-bearing or anti-cheat leaderboard needs a trusted game build and a
  signed/server-verifiable score source.

## Files

- `adapter/`: copy to `backend/adapters/word-score/`.
- `migration.sql`: append to the target site's protected `migrations/` folder
  using its next unused number. Never rename or edit a migration already run.
- `sample-event.json`: valid `score.completed` upload payload.
- `game-bridge.js`: game-side bridge sketch for the existing iframe contract.
- `site-data-provider.example.ts`: competition display configuration fragment.

## Activation

The verified adapter is built into template core. Preview the protected site
changes first, then explicitly apply them:

```text
npm run competition:install -- --adapter word-score
npm run competition:install -- --adapter word-score --apply
```

The installer selects `word-score`, updates the competition display mapping,
allocates the next unused immutable migration number, updates the site-owned
migration groups, backs up every replacement and rolls everything back when
validation fails. It does not execute SQL against D1 or deploy the site.

After installation:

1. Enable `matchEvents` and `matchBridge` for the game catalog entry.
2. Add the game-side bridge only to a build you control or are authorized to
   modify. Configure its parent origin and source namespace explicitly.
3. Review `npm run migrations:list`, apply the new SQL to the target D1
   database, then run the full production build before deployment.

The public route remains `/api/matches/batch` for compatibility. Under this
adapter it accepts `score.completed` events rather than 1v1 match events.

## Event boundary

Send exactly one final event per run. `runId` is unique per profile, so retries
are idempotent and a second final submission for the same run is ignored.
The parent page already queues and acknowledges events through the template's
generic `matches.pending` / `matches.ack` bridge.
