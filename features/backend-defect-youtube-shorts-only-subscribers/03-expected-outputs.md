# Expected Outputs — A YouTube channel that only posts shorts must still show its subscribers

> Step numbers are those of `02-workflow.md`. "Compiles" is NOT an expected output.
> Added to the existing item 3b suites: `backend/tests/item3b-pipeline.test.js` (real API, real
> database, Apify mocked from the probe fixtures with a Videos-tab "no videos" answer) and
> `backend/tests/item3b-calculators.test.js` (pure).

| # | Step | Observable output | How it is verified |
|---|---|---|---|
| 1 | 1–3 | Full run on a shorts-only channel: run result success, account `ok`, snapshot subscribers 52000 / total_videos 7 / channel_id set, metrics long 0 / short 4 / uploads 4, `influencers.youtube_subscribers` 52000 | API + database; **fails on today's code** (snapshot subscribers null, channel_id null) |
| 2 | 4 | Brand payload `social.youtube`: state ok, subscribers 52000, avgLongViews null, avgShortsViews > 0, uploads90d 4 | API |
| 3 | 5–6 | Profile run afterwards: success, two Apify calls (Videos then Shorts), latest snapshot still 52000, creator row still 52000 | database (`creator_social_runs.detail.runIds` length 2) |
| 4 | 7 | Profile run whose items carry no totals: success, snapshot count stays 1, creator row still 52000 | database; **fails on today's code** (a second, blank snapshot is written and written through) |
| 5 | pure | `youtubeChannel`: shorts fixture → 52000; first item stripped, second intact → 52000; all stripped → empty; nested `aboutChannelInfo.numberOfSubscribers "8.1K"` → 8100; `[{error:'CHANNEL_HAS_NO_VIDEOS'}]` → empty | unit; **fails on today's code** (stripped-first case gives null) |
| 6 | edges | Not-found and no-streams fixtures still map to not_found / empty; the probe channel still reads 52000 from the Videos fixture | the existing calculator test stays green |

## Regression gates
- `backend`: the full suite, serial, compared with `backend/baseline_cover_photo_stock.json` — 0 newly failing.
- Three older item 3b pipeline tests fail before and after on uploads-in-window counts (fixture
  dates aged past the 90-day window) — pre-existing, in the baseline, classified stale-fixture.
- No website or phone code is touched: their suites are not re-run.
