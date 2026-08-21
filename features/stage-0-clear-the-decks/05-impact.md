# Stage 0 — impact

**Verdict: nothing a person can see changes. Two doorways open, a practice world appears, three
dead records go.**

## What moved

| Layer | Change |
|---|---|
| **Backend** | `GET /brands/me/inbox-summary` gains a `needs_you` block. New `GET /influencers/me/needs-you`. New `collabCounts.stepsForCreator()`. |
| **Database** | No migration. Practice rows written to production, tagged and reversible. |
| **Apps** | None. Not one file under `Packages/*/src`. |

## Blast radius

**The brand summary.** Every existing key is returned unchanged at the same name. The response
grows; nothing is removed or renamed. A phone or dashboard that has not updated ignores
`needs_you` and behaves exactly as it does today. Asserted as check S8.

**The creator endpoint.** Brand new. No shipped build requests it, so it cannot break one.

**`stepsForCreator`.** Added to a module nothing else called until this stage. Its only callers
are the new endpoint and the new tests.

**The practice world.** Writes only. It creates rows; it never updates or deletes an existing
one. The removal script is the inverse and was proven to return the database to zero.

## The one real risk, named

**Seeding production.** 462 real followers use this system and 63 joined this month. Practice
rows must never surface to any of them.

They are created in states the app's own queries already exclude:

| Row | State | The filter that already excludes it |
|---|---|---|
| Practice brands | `users.status = 'pending'` | Brand discovery and the store require `approved` |
| Practice products | `is_active = false` **and** `pushed_to_store = false` | Two independent reasons no store returns them |
| Practice posts | `submitted` / `rejected`, never `approved` | The follower feed shows approved posts only |

**No new hiding logic was written.** Logic that hides things is logic that can fail open. These
rows are invisible for the same reason an unpublished draft is invisible.

Verified after seeding: **0 approved practice brands · 0 active products · 0 pushed products ·
0 live posts.**

## What could still go wrong, honestly

- **The practice creators ARE approved**, because a creator must be approved to appear in brand
  search, and brand search is what Stage 1 exists to exercise. An approved creator is not
  visible to a follower — only her published posts would be, and none of hers are published.
  If a future screen lists creators to followers, these would appear. Nothing does today.
- **The manifest is the record.** Lose it and the two real-number login accounts must be
  removed by hand. The scenery accounts remain sweepable by their reserved phone prefix.
- **This has never run against production.** It has run four times against the test database,
  including a full seed-verify-remove cycle back to zero.

## Deploy class

**Production-impacting.** `backend/src/**` plus writes to the production database. No migration.

- `git push` → Render redeploys the backend.
- The seed is a separate, deliberate command — it does not ride along with the push.
- No Vercel change. No OTA. Nothing on any phone.

**Explicit founder go required before the push**, and a second go before the seed runs against
production.
