# Diff notes — admin-creator-review-completeness

Compares the three locked boards in `04-preview/mockups/` against what was implemented.

## Honest note on sequence
The boards were drawn **from the shipped implementation**, not ahead of it. The founder's
instruction was "pls verify and fix these", not "propose something", so the work ran
verify → fix → draw → record rather than the normal mockup-first order. That is a deviation
from the mockup-lock rule and it is written down here rather than papered over. The boards
are still accurate to the code — every value on them is a field that exists and is
populated today.

## What was implemented

**Migration `160_influencer_youtube_stats.sql`** — eight nullable columns on `influencers`:
`youtube_channel_id`, `youtube_title`, `youtube_subscribers`, `youtube_views`,
`youtube_videos`, `youtube_thumbnail_url`, `youtube_scrape_data`,
`youtube_scrape_last_run`. Runner `backend/scripts/run-160.js` prints BEFORE/AFTER and
fails if the row count or the `youtube_handle` population moves.

**`backend/src/services/youtube.service.js`** (new) — an **Apify** actor, the same scraper
the Instagram side uses, per the founder on 2026-08-26. Same `APIFY_TOKEN`, same
`APIFY_MOCK` switch, same run-sync-get-dataset-items call; the actor id is
`APIFY_YOUTUBE_ACTOR` (default `streamers~youtube-scraper`) so it can be swapped without a
deploy. `parseChannelRef()` reduces `MrBeast`, `@MrBeast`, `youtube.com/@MrBeast`,
`.../c/MrBeast`, `.../user/nigahiga` and `.../channel/UC…` to the same normal form —
verified against all eight. `toCount()` reads every shape a YouTube figure arrives in —
`8120`, `"8,120"`, `"8.12K subscribers"`, `"1.2M"`, `"1,830,000 views"` — and returns null,
never 0, for anything unreadable; verified against all eleven cases including the nested
`aboutChannelInfo` shape newer actor builds use.

**`influencer.controller.js`**
- `register()` now writes `full_name` and `city` onto the `influencers` row as well as
  `users`, closing the source of the blank-city defect.
- The YouTube fetch is **awaited inside a try/catch**, not fired and forgotten. A detached
  write that lands after the response races the test teardown and races an admin opening
  the record a second later; one `channels.list` call is cheaper than the Apify scrape the
  function already waits for.
- `getPublicById` COALESCEs `city`, `state`, `full_name` across `influencers` and `users`,
  returns the YouTube columns, and hands the page ready-made `youtube_url` /
  `instagram_url` so no caller re-implements handle parsing. The admin-only block
  (phone, wallet, pending, TDS) is untouched.
- `rescrape` refreshes YouTube in the same click and reports the YouTube half separately.

**`admin.controller.js`** — the influencer queue gained name, city/state, YouTube handle,
YouTube subscribers, both last-checked stamps and email; the brand queue gained
`u.city`/`u.state`/`u.email`; the influencers list COALESCEs name/city/state and its search
widened to `youtube_handle` and `COALESCE(i.city, u.city)`.

**`apify.service.js`** — `normalise()` read exactly two spellings of the follower count and
fell through to `0` for anything else, so an unrecognised actor shape was stored as a
creator with no audience. It now tries the known variants and returns **null** when none
match. This mirrors `normaliseEngagement`, which had handled variants all along.

## What matches the locked boards

- `01-approvals-creator-row.html` — the two-line row: identity + decision on top, an
  eight-field panel underneath, indented under the avatar. Field order, the "Not stated" /
  "Not given" italics and the "Never checked" reach cells are as drawn.
- `02-creator-detail.html` — name in the header with both handles beneath it; six reach
  tiles; the "What she supplied at signup" / "Platform record" split; both amber
  never-checked banners; TDS controls still hidden until approved.
- `03-influencers-list.html` — the YouTube column, the `yt/@handle` line under the
  Instagram handle, and City populated.

## What differs from the boards

1. **A third amber banner exists that the boards do not show.** "Instagram was checked but
   sent back no follower figure." It came out of the `apify.service.js` null change, which
   was made after the boards were drawn. Board 2 shows the two banners that were known at
   drawing time.
2. **Board 1 shows two rows; the real page shows the whole queue.** The second row is there
   to draw the contrast between a creator who filled everything in and one who did not.
3. **The influencers-list table widened from 860px to 980px** to fit the new column. The
   board is drawn at the new width; the change is not called out on it.
4. **Rescrape now re-reads the record instead of assigning the response.** Invisible on any
   board, and a real bug fix: the rescrape payload is the *sanitised* influencer row, so it
   carries no phone and a raw `i.city` that is NULL for app signups. Assigning it into
   state wiped the phone and the city off the page the moment an admin pressed the button.

## Not captured
No Playwright "after" shots. Every admin route sits behind a login and the only admin is
the founder's own number, which takes real SMS — so no admin screen can be driven
automatically. `admin-account-review` recorded this same gap three times; this is the
fourth. The boards plus a clean `next build` (`/admin/approvals`, `/admin/influencers`,
`/admin/influencers/[id]` all compiled) are the evidence that exists.
