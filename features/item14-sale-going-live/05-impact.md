# item14-sale-going-live — impact

**Production-impacting.** Backend (Render), phone apps (OTA for brand and influencer; native
runtime unchanged), migration 199. **Explicit go required before migrate, push or OTA.** The
brand website and admin pages are not changed (the Platform settings page draws the new number
from the settings service with no page change).

## What changes for people
- **Creators (app):** after a Pay for Sale shoot, the shoot screen offers **Go live — your posts**.
  Going live shows two paths: 1 · Shoppable posts (INFLX checks; "Create a shoppable post" opens
  the create flow with this collaboration filled in), and 2 · Social media (locked until INFLX
  approves her first post; then she names posts and places, uploads, sends, posts and links).
  Her Collabs card says where it stands. A completed Pay for Sale collaboration stays on her
  Active tab with its sales. The shoot-done notice no longer says "your content step is open"
  on Pay for Sale.
- **Brands (app):** the set's creator rows say where going live stands and chip the brand's move;
  the brand's screen shows her posts progress, reviews what she'll share, confirms live (said:
  no money moves), reports with three reasons, and shows the completed collaboration's sales split.
- **Admin:** one new number on Platform settings, "Pay for Sale confirms itself after" (7 days).
- **Shoppers:** nothing changes.

## Money
None. Pay for Sale has no fixed money; commission keeps running per item through the shop. The
confirmation writes only `collab_content` and `campaign_influencers.status`. Proved by check 12 and
by the migration runner's before/after compare.

## Data
Migration 199, additive: `content_social_rows` (new), three columns on `collab_content`, the
brand-report CHECK widened (+ not_posted, missing), the Delayed CHECK widened (+ six sale stages),
one `platform_settings` row. No backfill. Rehearsed on a 198-level database: 15/15 checks,
idempotent on a second apply, no money moved.

## Behaviour changes outside the new screens (each deliberate, each tested)
- `shoppablePosts.doneCounts` now counts a post INFLX approved after the posting date (v1.30).
  The Create tab card still stops showing after the posting date, as before.
- `contentGate` lets a new-terms Pay for Sale collaboration in (Hybrid stays out until item 15).
- A completed Pay for Sale collaboration stays in the creator's Active tab (it is still selling).
- The hourly Delayed lane also flags sale collaborations, self-confirms due ones and sweeps
  completions; the 48-hour reminder lane nudges sale moves.

## Risk
- Reusing item 12's content machinery must not change Pay for Content — item 12's suites pass,
  with three recorded assertion drifts that name the rule item 14 changed.
- Production holds no new-terms Pay for Sale collaboration with its shoot done yet, so nothing
  in production changes state at deploy; the phone walk waits on the first one.
