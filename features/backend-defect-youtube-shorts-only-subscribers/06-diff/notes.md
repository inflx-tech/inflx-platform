# Before / after — A YouTube channel that only posts shorts must still show its subscribers

Server only; nothing a person sees changes except the number itself, so no screenshots: the brand
app's Creator screen prints whatever the snapshot holds.

## Before (the founder's screenshot, 25 Oct 2026, a live creator)

| Place | Read |
|---|---|
| Top row, YouTube | **—** |
| YouTube card, Avg video views | — (correct: no long videos) |
| YouTube card, Avg shorts views | 646 |
| YouTube card, Recent uploads | 30 |

In the database that is a `creator_social_profile_snapshots` row with `subscribers NULL`, written
through to `influencers.youtube_subscribers NULL`, while `creator_social_metrics` holds the shorts.

## After (the same account, on its next profile run or admin Measure now)

| Place | Read |
|---|---|
| Top row, YouTube | **her subscriber count** (from the Shorts tab's items) |
| YouTube card | unchanged: Avg video views — · Avg shorts views 646 · Recent uploads 30 |

## Proof

- **Red first:** the three new checks were run on the code as it was. Full run on a shorts-only
  channel stored `subscribers null, channel_id null`; a totals-less profile run wrote a second,
  blank snapshot and blanked the creator's row; the calculator's stripped-first case gave null.
- **Green after:** the same three pass (`item3b-pipeline` 2, `item3b-calculators` 1).
- **Full backend suite, serial, vs `backend/baseline_cover_photo_stock.json` (11 Oct):**
  154 suites / 2183 tests / 1978 passed / 177 failed / 28 pending → 156 / 2221 / 2016 / 177 / 28.
  **0 that passed before fail now.** 39 new tests since that baseline, all passing (3 from this
  contract; 36 from item 21 and the creator address/bank work released after 11 Oct). 1 test renamed
  by item 21. The same 177 old failures by name; the same 1 suite that does not load
  (collection-library). Run stored as `backend/baseline_youtube_shorts_only.json`;
  the compare is `06-diff/backend-compare.txt`.
- **Pre-existing, left:** 3 item 3b pipeline tests fail before and after on uploads-in-window
  counts (long 3 → 0, short 4 → 2) because the probe fixtures are dated June–Sep 2026 and have aged
  past the 90-day window. Stale-fixture, in the baseline with the same diff; not a defect.
- **Not done:** no live read of the creator's rows (the session's production-read permission blocked
  it); the diagnosis is from the code and the 11 Sep probe fixtures and matches the screenshot
  exactly. `pnpm qa` not run (it drives the live site, which does not have this code yet).
