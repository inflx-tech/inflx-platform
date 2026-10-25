# post-performance-v2 — before / after notes

Board v1 (locked 25 Oct 2026 with M1–M3) against what was built. The phone screens are mounted
in `Packages/Mobile/src/screens/__tests__/postPerformance.test.js` with the server's real read
shapes (23 checks); the server side runs end to end in `backend/tests/post-performance-v2.test.js`
(24 checks, E1–E27). The website's four files are parse-checked with Next's Babel; the page was
not opened in a browser. Neither capture (Playwright for W1, Maestro for B1–B4 / C1–C4) was run in
the build session: the web sibling is declared in
`04-preview/mockups/post-performance-v2-v1.capture.json` and the phone flow in
`qa/maestro/flows/08-post-performance.yaml`, both for the founder's device walk.

## Built as drawn
- **S1** — one line under every link, the same words on every screen, from one file
  (`components/content/copyStats.js`): waiting in blue, a problem in orange, gone in red; the
  numbers in bold then the time ("Updated today 6:10 am", "Updated 3 days ago", "Last read 14 Jan");
  a photo post has no views; "Likes hidden" and "Comments off" are states, never zeros;
  "From her / your channel numbers, 12 Oct" until the first paid read; "Posted from @other, not
  her account" to the brand and the longer sentence with her own handle to the creator.
- **M1** — every number in full with Indian grouping (8,47,937), written without Intl because Hermes
  ships no locale data; the website uses the browser's en-IN.
- **W1** — the Analytics tab: tiles VIEWS · LIKES · COMMENTS · LINKS READ ("12 of 14 · 2 waiting"),
  then BY SET, BY CREATOR ("Social links not added yet" in blue for a creator with no link), BY LINK
  with the creator, the row ("Instagram reel 1 of 2" / "Instagram reel · Festive Sarees (K7M2F9)"),
  the link opening in a new tab, and the one line; one Update now for the campaign, "Updated …"
  beside it; the footnote as the board gives it. The sales tiles stay below the social tiles. The
  header strip's AVG ER box became VIEWS with "n of m links read"; the header's "↻ Refresh analytics"
  (which re-scraped every live deliverable) is gone with the per-row ↻.
- **W2** — admin's Apify line reads "… of $5 budget · creators $x (n runs) · posts $y (n runs) · a post
  read waits when the month is tight; creator numbers don't"; the flags list gains "Posted from
  another account" with the collaboration, the row and both handles.
- **B1** — the brand's content screen: under each link the three numbers as boxes with the time line;
  the stories keep their screenshots with "Screenshots · stories can't be tracked"; the links stay on
  the live and completed screens; Update now at the foot once live, with "Reads her links once ·
  once a day".
- **B2** — the brand's Going live screen: each row's link gets its line at the posted stage; once
  confirmed, "Her links" with their numbers and Update now at the foot; the one yellow button stays
  "Confirm it's live".
- **B3** — the set posts list: the set's views on social media beside its orders; one more line per
  post — the numbers and the link count, "Social links not added yet" in blue from the posting date
  (M3), "Last read 14 Jan" on a post that left the shop.
- **B4** — the brand's post stats: "On social media" above "By channel", one card per link with its
  place and date, the link, Open, and the three numbers; no Update now (M2).
- **C1** — her content screen after "I've posted everything": her links with their one line (the
  reel from her channel numbers, the Short waiting), the stories' line, and the schedule note said
  once. No Update now on this screen (M2).
- **C2** — her Going live screen once the brand confirmed: "Your links" with one line each, the
  other-account sentence with her handle, "Facebook numbers come later"; Update now with "Once a day".
  An outside row's link shows its line under the box as soon as it is saved.
- **C3** — Post status: one line under Share and Stats; "Where you shared it" lists each link with
  its date and views.
- **C4** — her post stats: "On social media" above the channels with Update now; pressed again the
  same day, the server's sentence ("Numbers were updated 2 hours ago. Once a day.") shows as the
  toast.

## Decisions in the build (recorded here; none changes a locked screen)
- **Tracked links keep their own row id** (`proof_stats.id`), with the slot unique only among open
  rows: an outside row's replaced link closes the old row (`link_changed`) and opens a new one, as
  the spec asks, which the proof's own key could not hold.
- **The curve is read from the due date, not from the read count**: after a read the next due is
  the first curve point after the later of the row's due date and now, so a skipped day (budget,
  Apify down) is caught up with ONE read and the curve continues; after day 30 every 14 days; never
  past day 90, where the job stops the row on arrival (day 91). Update now reads without moving a
  due date that is still ahead.
- **A not-found answer stops the link and counts as a read** (Instagram's error item is charged too,
  as the probe showed); a YouTube id that answers nothing is not found by set difference on `id`,
  never by position. An item that cannot be read keeps its due date and is tried again tomorrow.
- **Update now is one per collaboration per 24 h for both sides together** (the brand's press counts
  against hers), judged from the run log (`detail.ciId`), so no column was added; the website's one
  Update now is one per campaign per 24 h (`detail.campaignId`). Admin's read of a collaboration's
  links is exempt from the day and the budget (`POST /admin/collabs/:ciId/content/stats/refresh`).
- **The post read carries the summary** (`shoppablePosts.getPost → social`) so Post status needs no
  second call; the stats reads carry the full list (`social[]`) and the summary (`social_summary`);
  the set posts list carries a summary per post and the set's views.
- **`proof_stats.numbers_at`** (when the numbers shown were read) sits beside `last_read_at` (the last
  attempt), so "Couldn't read this link" keeps the last numbers and their own time.
- **The two older sync helpers** (`apify.service.scrapeProfile`, `youtube.service`) now send the
  token in the Authorization header: E26 asks that no Apify URL in `backend/src` carry `token=`, and
  both built one. Behaviour otherwise unchanged.
- **Owner check**: her handle as `ownerUsername` or among `coauthorProducers[].username` (Instagram);
  `channelId` = her `platform_account_id` or `channelUsername` = her handle / the handle in her
  `channel_url` (YouTube). One `owner_mismatch` flag per link while unresolved, carrying the
  collaboration, the row label and both handles.

## Caught by the suites, and fixed in the code
- The website's BY LINK list read `creator_posts.title`, which does not exist — the post's title is
  derived (`shoppablePosts.titleOf`) from the caption, the offer or the kind; now derived the same way.
- Two legacy suites encoded the retired path (`tests/engagement.test.js` ran the deleted cron and
  asserted `avg_er`; `tests/item12-phase2a.test.js` asserted `refresh-stats` was mounted). Both now
  encode the rule as it is: the cron is gone, the shape is new, the door answers 404.
- The phone's record of outline buttons that pass `disabled` (ui-walk-fixes E-6,
  `components/remote/__tests__/cancelWhileBusy.test.js`) caught the four new Update now buttons —
  by design off while their read runs, so one tap sends one read — and now records them.
