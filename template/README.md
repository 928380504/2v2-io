# Template releases and safe updates

`template.json` defines the reusable core, protected site areas and the current
semantic version. `release-manifest.json` records a SHA-256 hash for every core
file in a published template release.

## Publish the current core

Update `TEMPLATE-GUIDE.md` and `CHANGELOG.md` before publishing. The guide
frontmatter version must match the release version, and its documentation
revision must match `template/template.json`.

```text
npm run docs:check
npm run backend:check
npm run competition:examples:check
npm run competition:install:test
npm run filters:check
npm run site:create:test
npm run site:export:test
npm run site:admin:test
npm run cloudflare:test
npm run template:fleet:test
npm run site:adopt-legacy:test
npm run site:extract-legacy:test
npm run functions:migrate:test
npm run template:release -- --version 2.22.6
npm run template:verify
```

Release only after the documentation check, site validator, type check and
production build pass. Documentation files are part of the reusable core and
are covered by the release SHA-256 manifest.

## Create a new site package

Start from the versioned example blueprint. Preview is mandatory before apply:

```text
npm run site:create
npm run site:create -- --apply
npm run site:create -- --from examples/site-blueprint.example.json
npm run site:create -- --from path/to/site-blueprint.json --apply
```

The generator writes only site-owned configuration and content, creates a
resource checklist, backs up replacements and rolls back failed validation.
It never copies licensed assets, runs D1 SQL, deploys, or overwrites protected
Functions and existing migration history. A selected built-in competition
adapter may append its packaged next-number migration and migration group.

`site/blueprint.json` is the editable source intended for a future visual
admin. If a site was changed directly, use `npm run site:export` to preview the
reverse export and `npm run site:export -- --apply` to back up and refresh that
blueprint before the next template-driven generation.

Run `npm run site:admin` for the local visual editor. It covers identity,
routes, theme, page copy, FAQ, games, filters, Legal content, Cloudflare/D1,
competition adapters and ranking exclusions. It binds only to the loopback
interface, uses a temporary token, previews changes before save, and applies
the same asset checks, backups, validation, and rollback as `site:create`. The
image controls preview paths and browse supported files already in `public/`;
the home and game article fields also expose an optional ordered-section editor
without removing raw HTML access. Resource browsing is read-only and performs
no upload or asset copying. Admin assets are template tooling and are never
routed by the public Next.js application.

## Deploy to Cloudflare

Keep account-specific deployment metadata in protected `site/cloudflare.json`,
then use the read-only audit before any remote action:

```text
npm run cloudflare:check
npm run cloudflare:provision
npm run cloudflare:migrations -- --remote
npm run cloudflare:deploy
npm run cloudflare:health
```

Migration and deploy writes require `--apply` plus the exact confirmation token
printed by the audit. No API token is stored in the repository. Every generated
website must use a newly created, site-exclusive D1 database; the wizard applies
its selected schema from the beginning and Wrangler records later schema updates.
Provisioning also requires its own `<site/database/create>` confirmation token,
refuses to replace a populated database ID, backs up the site config, and writes
the new UUID locally. The temporary Pages config contains both the output
directory and D1 binding, so the confirmed deployment applies that binding.
Remote CI commands read `CLOUDFLARE_API_TOKEN` from the environment; never add
that token to the protected site package or any committed configuration file.

## Connect an existing game site once

Preview adoption first, then write its local baseline:

```text
npm run template:sync -- --target "H:\path\to\game-site" --adopt
npm run template:sync -- --target "H:\path\to\game-site" --adopt --apply
```

Adoption does not copy template files. It only records the target site's
current core hashes so later updates can distinguish untouched files from
local edits.

## Update a connected site

```text
npm run template:sync -- --target "H:\path\to\game-site"
npm run template:sync -- --target "H:\path\to\game-site" --apply
```

The first command is always a read-only preview. Applying creates a recoverable
backup under `backups/template-upgrade/`. Local modifications to core files are
reported as conflicts and stop the update; move those customizations into
`site/overrides` whenever possible.

The updater never touches `site`, `public`, Pages Functions, database
migrations or environment files. Functions and migrations remain protected
because their match and ranking contracts can differ between game genres.

## Preview or update every connected site

Copy `sites.example.json` to the ignored local file `sites.json`, then add each
site's ID, display name, path and enabled state. Preview is always the default:

```text
npm run template:fleet
npm run template:fleet -- --site 1v1-lol,temple-run
npm run template:fleet -- --apply
```

The fleet command invokes the single-site updater independently for every
target. It writes a machine-readable summary to `template/reports/latest.json`
without adding the local registry or reports to a template release.

## Adopt a legacy site without a site package

First extract a reviewable blueprint from a supported legacy
`stimulation-clicker` site. Preview mode never writes to the legacy source:

```text
npm run site:extract-legacy -- --target "H:\path\to\legacy-site"
npm run site:extract-legacy -- --target "H:\path\to\legacy-site" --output "template\reports\site.blueprint.json" --report "template\reports\site.extraction.json"
npm run site:create -- --from "template\reports\site.blueprint.json"
```

The extractor supports one category and at most 100 games. It resets legacy
traffic/rating metrics, automatically infers filter attributes, never copies
or downloads assets, and reports missing resources and unmapped routes. If the
homepage game is absent from the old catalog, its primary record is generated
automatically. Inferred attributes can be refined after hands-on migration
testing. Legacy cover components are inspected for the homepage background and
logo paths. Use `site:create --apply` only after supplying authorized local
resources and resolving any remaining warnings.

If a complete domain-matched `site` package already exists, skip extraction.
Audit first, then explicitly bootstrap the protected package and baseline:

```text
npm run site:adopt-legacy -- --target "H:\path\to\legacy-site"
npm run site:adopt-legacy -- --target "H:\path\to\legacy-site" --apply
```

Adoption does not perform the core update. It adds a domain-matched `site`
package and records the untouched legacy core as `0.0.0-adopted`. Run
`template:fleet` afterward to review every actual replacement and removal.
Protected Functions and migrations are reported but never overwritten.

## Migrate protected Pages Functions

After adoption and the reviewed core update, preview the protected API wrapper
migration separately:

```text
npm run functions:migrate -- --target "H:\path\to\game-site"
npm run functions:migrate -- --target "H:\path\to\game-site" --apply
```

The command requires the reusable backend and site adapter configuration to
exist before writing. It backs up replacements, preserves target-only routes,
runs the target backend validator and restores the old Functions on failure.
It never modifies D1 migrations.
