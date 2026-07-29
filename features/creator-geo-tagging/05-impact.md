# 05 — Impact

**Verdict: adds the one missing field the founder's tagging workflow
needed, makes area search a dropdown instead of a guess, and recovers
20 onboarded creators that city search could not see.**

## Mechanics

- **Schema:** one additive column (`creator_profiles.state`) + one
  index. `ADD COLUMN IF NOT EXISTS`, idempotent.
- **View:** `CREATE OR REPLACE VIEW` — `state` appended **last** on
  both branches (existing column names, types and order are unchanged,
  which the statement requires), and the onboarded `city`/`state`
  expressions become `COALESCE`.
- **API:** `?state=` on search (additive), `state` on each result row
  (additive), one new endpoint `GET /influencers/locations`.
- **Bulk intake:** new `updated` counter and a new per-row
  `action: 'updated'`. Existing counters keep their meaning.

## Behaviour changes worth naming

1. **Duplicate handles carrying a city/state are now written to, not
   skipped.** This is the point of the feature, but it does mean a
   bulk upload can now modify existing rows. Scope is tight: only
   `city` and `state`, only when supplied, never scraped metrics. A
   row with no geo still skips exactly as before.
2. **Onboarded creators gain a city in search** (8 → 28 on
   production). Brands will see more results for city searches than
   yesterday. That is a correction, but it is visible.
3. **Free-text city becomes a dropdown.** A brand cannot type an
   arbitrary city any more — they pick from what exists. Intentional,
   and the reason `hyderabad`/`Hyderabad` stops mattering.

## Risk

Low-moderate, concentrated in the migration.

- The view is reproduced in full (145 lines). Transcription risk is
  the real hazard, which is why it was applied against the production
  schema inside a rolled-back transaction and the resulting column set
  and row counts were checked before asking for a go.
- `MODE() WITHIN GROUP` is standard PostgreSQL; verified executing on
  the production server.
- `state` is deliberately absent from `CREATOR_COLUMNS`, so the ingest
  endpoint cannot write it. If the n8n workflow is ever changed to
  send a state, it will be silently dropped — correct, but worth
  knowing.

## Ordering dependency

`GET /influencers/locations` and `?state=` both read a column that does
not exist until migration 146 runs. **The migration must be applied
before the backend deploys**, or both will error. Render deploys on
push, so the migration is run first, by hand, via
`node backend/scripts/run-146.js`.

## Classification

**Production-impacting, and the first in this batch to include a
migration.** Backend → Render, brand-web → Vercel, plus a manual
migration step against the production database. Explicit founder go
required; the migration is not run without it.

## Verification

- Migration + locations query + state filter executed against the
  **production** database inside `BEGIN … ROLLBACK`; absence of the
  column re-confirmed afterwards.
- `pnpm qa` — see `06-diff/notes.md`.
