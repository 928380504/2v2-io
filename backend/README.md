# Backend modules

The Pages Functions routes in `functions/api` are intentionally thin and keep
the public `/api/*` contract stable. Reusable implementation lives here.

## Layers

- `core/` contains D1 and HTTP primitives shared by every module.
- `community/` contains reusable comments, ratings, reactions and engagement.
- `adapters/` contains game-specific match, profile, feed and ranking logic.
- `runtime.ts` selects the competition adapter declared by `site/backend.ts`.
- `migrations.json` groups immutable migration files without renaming them.

To add a different competition model, create a new adapter implementing
`CompetitionAdapter`, register it in `runtime.ts`, extend the adapter ID union,
and select it in `site/backend.ts`. Do not rewrite an existing adapter merely
to support another game's score model.

A complete score-based reference is available at
`examples/competition-adapters/text-twist-2-untimed`. It intentionally remains
inactive until a target site runs `competition:install`, reviews the protected
changes, installs its D1 migration and selects `word-score`.

Historical SQL files stay in `migrations/` with their original numbers. New
migrations are appended there and added to exactly one group in the protected
`site/competition-migrations.json`. Old sites without that file continue to
fall back to `backend/migrations.json` until an adapter install creates it.
