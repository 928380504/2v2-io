# Site package

This directory contains everything that belongs to one website rather than to
the reusable game template.

## Global manifest

`blueprint.json` is the editable source for the site generator and the future
visual administration UI. `manifest.json` is the generated runtime source for
site identity, domain, public routes, feature switches and theme tokens. The
TypeScript modules in this directory read the runtime files; do not duplicate
those values in components.

`game-filters.json` is the single source for game attribute groups, options,
defaults, URL aliases, icons and `game:add` parameter names. Change this file
when a site needs a different taxonomy; core filter and recommendation
components must not hardcode one game genre.

## Replace for a new site

- `site.ts`: identity, domain, SEO, assets, navigation and integrations
- `routes.ts`: public paths
- `theme.ts`: colors, widths and layout tokens
- `features.ts`: feature switches
- `backend.ts`: D1 binding name and competition adapter selection
- `cloudflare.json`: Pages project, fresh D1 identity, placement and health checks
- `competition-migrations.json`: site-owned immutable migration groups
- `data-provider.ts`: API endpoints, cache policy and competition adapter data
- `runtime.ts`: browser storage keys, custom events and game bridge identity
- `content/`: games, page copy, legal copy, filters and ranking eligibility
- `overrides/`: optional replacements for major reusable components
- `generated/`: remote ad configuration and build-time rating snapshots

Core components should import stable modules from `config/`. Those files are
thin compatibility facades that forward to this package, so template updates
can replace core code without overwriting site-specific data.

## Select a competition model

List and preview built-in adapter packs before applying one:

```text
npm run competition:install -- --list
npm run competition:install -- --adapter word-score
npm run competition:install -- --adapter word-score --apply
```

The installer updates `backend.ts`, the competition portion of
`data-provider.ts`, the site migration groups and one newly numbered SQL file.
It creates a backup and restores all changes if validation fails. Remote D1
execution and deployment remain explicit follow-up steps.

## Validate a site

Run `npm run filters:check` and `npm run validate-site`. Validation also runs automatically before local
development and production builds. It checks routes, IDs, assets, time zone,
navigation, game references, categories and generated snapshots.

## Add game pages

Preview one generated catalog entry before writing anything:

```text
npm run game:add -- --id space-arena --title "Space Arena" --description "A useful description containing at least forty characters."
```

Add `--apply` only after reviewing the route, attributes and asset URLs. For
multiple games, copy `examples/game-import.example.json` and run
`npm run game:add -- --from your-file.json`. The generator creates one backup
for the batch and restores the old catalog automatically if validation fails.

## Create a fresh site package

Copy the example blueprint, replace its site identity, routes, category,
filters, games and content, then preview the complete generated package:

```text
npm run site:create
npm run site:create -- --apply
npm run site:create -- --from examples/site-blueprint.example.json
npm run site:create -- --from path/to/site-blueprint.json --apply
```

The preview lists every file that would change and every missing local asset.
Apply is blocked until those local assets exist. A successful apply creates a
backup under `backups/site-create/`; failed validation restores the previous
package. `site/generated/resource-checklist.json` remains as the auditable
resource handoff. Public assets, Functions, deployment and remote D1 execution
stay outside the generator. Selecting a not-yet-installed built-in competition
adapter may append its packaged immutable migration and migration group, but
the generator never edits an existing migration or executes SQL.

`site:init` remains available only for old automation that intentionally
changes the manifest alone.

If an existing site was edited directly, preview and safely refresh the
editable blueprint with:

```text
npm run site:export
npm run site:export -- --apply
```

The apply command backs up the previous blueprint. Keep the blueprint and
generated runtime files synchronized; `site:export:test` enforces lossless
round trips for rich game copy, legal pages, taxonomy and initial statistics.

For a non-technical editing workflow, run `npm run site:admin`. The local-only
studio edits this same blueprint through dedicated forms for identity, routes,
theme, page copy, FAQ, games, filters, Legal content and deployment metadata.
Image fields provide immediate previews and a read-only picker for supported
files that already exist in `public/`. Home and game article HTML can also be
edited as ordered sections while the original HTML textarea remains available.
It previews generated file changes, checks assets, requires site-ID
confirmation, and reuses the normal backup, validation, and rollback pipeline.
It is not exposed as a public Next.js page. The picker does not upload, copy,
download, or license assets; add reviewed site-owned resources separately.

Each generated website uses its own newly created D1 database. Do not point a
new site at another website's database and do not copy an existing database as
part of site creation. After the database ID is configured, the Cloudflare
deployment wizard applies this site's selected schema from `0001` and lets
Wrangler track later schema updates.

Preview and create that database with:

```text
npm run cloudflare:provision
npm run cloudflare:provision -- --apply --confirm <site/database/create>
```

The second command creates the remote resource, stores a recoverable copy of
the old config, and writes the returned UUID to this package. `location` is a
placement hint; use `enam` for an audience concentrated in eastern North
America or change it in the blueprint for another audience.

## Override a template component

Edit only `overrides/components.ts`. Available slots currently include the
navigation, activity feed, footer, feedback widget, game player, leaderboard,
related-game strip, game ranking panel, article body and friend links. Every
slot is optional, so an empty object keeps all template defaults. See
`overrides/README.md` for a typed example.
