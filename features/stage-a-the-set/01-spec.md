# Stage A — the set

**Makes the middle layer real.** Nothing else in the locked design can be built
until a set carries its own aim, day and shoot mode.

Design of record: `features/screen-atlas` (mockup-locked 2026-09-01).
Plan: `Docs/IMPLEMENTATION_PLAN.md`.

## Screens this stage builds

`SB-23` · `SB-24` · `SB-25` · `SB-26` · `SB-27` · `SB-28` · `SB-29` · `SB-30` ·
`SB-37` · `SC-05`

## Actions this stage completes

`BR-01` start a campaign · `BR-02` build a set · `BR-03` find creators ·
`BR-04` invite into a set · `BR-10` set one creator's terms ·
`BR-11` give her an offer · `BR-13` publish · `CR-01` answer a collaboration

Countering is **not** in this stage. She can accept or decline; asking for
something different is Stage B.

---

## What reading production changed

Two things, and both make this stage smaller and safer than the plan assumed.

### 1 · The aim already exists

`campaign_sets.goal` is already a `campaign_goal` enum:

| Value | The design calls it |
|---|---|
| `conversion` | pay per sale |
| `engagement` | pay for content |
| `hybrid` | both |

`buysContent()` already reads it. **No migration needed for the aim.**

### 2 · There is nothing honest to backfill

The plan proposed migration 167 to fill `go_live_date` from `window_end`.
Production says otherwise:

| | |
|---|---|
| `campaign_sets` rows | **11** |
| with `window_end` set | **2** |
| with `window_start` set | 7 |
| `content_end_date` set | **0** — confirms the dead column |
| `contracts` with `production_mode` | **1 of 6** (`visit`; the rest null) |

Filling a go-live day for nine sets from a column that is null would be
inventing dates for live campaigns.

**So there is no backfill.** A set with `go_live_date IS NULL` is a
**pre-set-first set**; the existing `window_start`/`window_end` fallback keeps
serving it, exactly as it does today. The new wizard requires the field; nothing
old is rewritten.

**Migration 167 is dropped from the plan.** Three migrations touching live rows
becomes two, and neither of them is in this stage.

---

## Modes: two on the screen, three in the code

The code has carried three since migration 024:

| Code | Meaning | Who marks it done |
|---|---|---|
| `visit` | she comes to the store | **both** |
| `shipment` | you send her the products | she alone |
| `remote` | nothing sent — she works from your images | she alone |

The atlas draws two and calls the second **"remote"** — but everything Book 3
describes under that name (her address, tracking, "everything arrived") is
`shipment`.

**Founder's decision, 2026-09-01: the wizard offers two.** *Store visit* and
*we send the products*. The second stores **`shipment`**, never `remote`, so the
no-parcel path cannot be reached from a set by accident.

`remote` stays reachable only by the older brand-approve flow. It is not
removed — six live contracts resolve their mode through it.

---

## Migrations

| # | What | Touches live rows |
|---|---|---|
| **165** | `campaign_sets` gains `go_live_date`, `shoot_mode`, `invites_close_at` | **no** |
| **166** | `campaign_influencers` gains `channels_json` and `formats_json` | **no** |

Both additive, nullable, `IF NOT EXISTS`, no defaults, no destructive change.
An existing row cannot be made invalid by either.

`166` moves two fields **down a level** — from the set to the creator — because
what she posts and what she makes are hers, not the set's. The set keeps its
columns; new code reads the creator's and falls back to the set's, so nothing
in flight breaks.

---

## Adjacent fix, carried in quietly

`cancelInfluencer` writes `status='cancelled'` to `contract_status`, which has no
such value. Confirmed live; it throws the first time it runs. One line, in scope
because `BR-05`'s "drop her" is one step from it.
