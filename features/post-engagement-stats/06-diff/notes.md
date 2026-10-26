# Before / after — post-engagement-stats (Level 4: what shoppers do with a post inside INFLX)

Built 26 Oct 2026 against board v1 (locked 26 Oct 2026 as drawn). Server + brand app + creator app;
no migration, no job, no Apify, no money.

## Before (the screens as released by post-links-codes and post-performance-v2)

| Place | Read |
|---|---|
| Her Post stats (C4) | money row → "On social media" → Visits by channel → Orders by channel; nothing about likes, comments, views inside INFLX |
| Her Post status (C3) | Share · code / Stats, then the social line |
| Brand's Set posts row (B3) | visits · orders · sales · commission, then the social line |
| Brand's post stats (B4) | as C4, read-only |
| Comments | shoppers read and write them; no creator or brand screen; no reply, no hide |

## After (the six frames of the board)

| Place | Read |
|---|---|
| C4 / B4 | **In INFLX** block between the money row and "On social media": views · likes · comments › · shares, then saves · shop taps · added to bag · finished (video only); the hint "Shoppers inside INFLX since 10 Oct. Guests count for views, shares and taps; likes, comments and saves need an account."; the comments box opens the Comments screen |
| C3 | one line above the social line: **In INFLX** · 1,840 views · 212 likes · 38 comments (grey "In INFLX · nothing yet" on a post nobody opened) |
| B3 | the same line on every row, under visits and orders, above the social line |
| C5 (new) | Comments · Festive Sarees · "38 comments · newest first"; shoppers' comments with her replies nested as "You"; Reply opens the box ("Reply as Priya Rao…", 0/300, one yellow Send); Hide greys the row with "Hidden · only you see this" and Unhide |
| B5 (new) | the same screen read-only: "… · Only Priya Rao can reply or hide"; her replies carry a "creator" tag; no buttons, no box |

## Proof

- **Red first (backend):** `backend/tests/post-engagement-stats.test.js` run on the code as it was: 11 of 13 failed
  exactly as the fault describes — every comment route 404, no `inflx` key on stats / status / set posts,
  the dead like/save counts still in `creatorPosts.service.js`. (E10's 404s and E16's money snapshot passed
  vacuously before the build; after it E10 passes for the right reason — ownership.)
- **Green after (backend):** 13 / 13. Activity is written through the shopper app's own endpoints (events batch,
  like, save, comment, report, admin decide), never inserted: E1 counts 5 views (3 guest + 2 account opens),
  1 like (one taken back), 1 comment (one hidden, one removed), 1 share, 1 save, 3 shop taps, 1 added to bag,
  1 finished (video); E3/E4 zeros and `finished null` for a photo; E5–E9 the comments screen's rules; E10/E14
  other creator / other brand 404; E11–E13 the brand's rows, block and read-only list; E16 money untouched;
  E17 dead counts gone.
- **Neighbours (backend):** post-links-codes, post-performance-v2, item20-own-brand, shopper-app-v2,
  shoppable-posts-v2 + the new suite: 159 / 159.
- **Full backend suite, serial, vs `backend/baseline_youtube_shorts_only.json` (25 Oct):**
  156 suites / 2221 tests / 2016 passed / 177 failed / 28 pending → 158 / 2259 / 2054 / 177 / 28.
  **0 that passed before fail now.** 41 new tests since that baseline, all passing (13 from this contract,
  28 from post-performance-v2 released 25 Oct); 3 base tests renamed by post-performance-v2 (the legacy
  refresh-stats checks). The same 177 old failures by name; the same 1 suite that does not load
  (collection-library). Stored as `backend/baseline_post_engagement_stats.json`; compare in
  `06-diff/backend-compare.txt`. qa_all_green stays false on the pre-existing failures: the certification is
  no-regression, never green.
- **A first full run caught a real fault:** an intermediate patch read `cp.title` (not a column) for the
  "Reply as Priya" name, which passed in isolation only because the neighbour run had started before it.
  Fixed (the name read alone), the suite rerun from scratch: the numbers above are the rerun.
- **Mobile render tests (E18–E20):** `Packages/Mobile/src/screens/create/__tests__/engagementStats.test.js`
  10 / 10 — C4 eight boxes, the hint, the door to Comments; a photo post without "finished"; zeros; an old
  server without numbers draws no block; B4 and its door; C3 line and "nothing yet"; B3 lines; C5 list, nested
  reply, hidden row, Reply → box → Send, Hide, Unhide, the server's refusal in its words; B5 read-only.
- **The house rule the full mobile run enforced:** `creatorStrips.test.js` refuses a screen with a text box
  that scrolls in a plain ScrollView — the Comments screen now scrolls in `FormScroll` and is registered in
  that test's list of typing screens. **Full mobile suite: 132 / 132 suites, 3065 / 3065 tests.**
- **Lint:** 0 errors on every touched file (mobile warnings are the pre-existing `api.js` ones plus one
  inline contentContainerStyle, the same pattern the neighbouring Post stats screen uses).

## Not done
- No device walk: the board's six frames are proven by render tests, not on a phone. The founder's walk
  (C3 → C4 → C5 reply and hide → shopper app sees the reply and loses the hidden comment; B3 → B4 → B5) is
  the functional gate after the release.
- Production volume of the event log was not read (permission); `/admin/feed` readiness panel has it.
- Not pushed. Release = Render + OTA brand + OTA creator (runtime 4), one publish at a time, on the founder's go.
