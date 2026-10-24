# item21-content-posts — before / after notes

Board v2 (locked 24 Oct 2026) against what was built. Screens are mounted in
`Packages/Mobile/src/screens/__tests__/item21.test.js` with the server's real read shape; the server
side runs end to end in `backend/tests/item21-content-posts.test.js` (18 checks).

## Built as drawn
- **T1 / T4** — fee, deliverables, then "Shoppable posts in INFLX" (1–10) and "What she posts about"
  with three rows: Entire store, Offers, Products without offers. The summary reads "She posts about:
  your entire store · 3 shoppable posts" and "No commission — the fee is her whole pay." A missing
  number or nothing to post about is refused in her name under its own box.
- **T2** — Entire store is a row, not a sheet: one tap sets it and the two rows below read "Covered by
  Entire store"; tapping it again or opening a row lets it go. (The board drew a three-way sheet; the
  row keeps the two existing sheets untouched and reads the same.)
- **T3** — Pay for Sale and Hybrid gain the same row; the summary reads "She can sell: your entire store".
- **T5 / C3** — the agreement names "Shoppable posts · 3 in INFLX · no commission" and "You post about ·
  Everything in the store, now and later" (the PDF too).
- **C1 / C2** — the invitation shows both rows; the counter has the posts number with "They asked for 3";
  what she posts about is locked to the brand.
- **C4 / C5** — "What you post about" with the no-commission line and, on the Entire store, the living words.
- **G1 – G7** — Path 1 above Path 2 on both screens, drawn with item 14's progress bar and post rows;
  "Create a shoppable post" opens item 13's flow with the collaboration filled in; Path 2 locked with
  the reason until the first approval; the confirm sheet names what still waits; the amber line names
  the held ₹ and the posts short; the brand's "She hasn't made her shoppable posts — tell INFLX" past
  the posting date; Completed when the last approval releases the final 50%.
- **G8** — an old-terms Pay for Content collaboration is item 12 exactly as it was (no Path 1, no lock).
- **P1 / P3 / P5** — the Create tab lists the collaboration with "fixed fee · no commission"; a post's
  stats say "1 sale · ₹1,299", never "to you".
- **W1** — the End-offer dialog adds "It's also in N signed collaborations that sell your entire store."

## Decisions in the build (recorded here, none changes a locked screen)
- **Entire store counts products in no offer TODAY** (a product whose offer starts later is at normal
  price until then) — item 20's own-brand rule, so the picker and the count agree.
- **The first post opens Path 2 the moment INFLX approves it**, read live from the posts table; nothing
  is stamped, so a post taken down later does not re-lock a package already sent.
- **A due final 50% that is short is marked `release_held_for_posts`** so the job's log and the admin's
  escrow page can say why a queued row did not pay; the approval that completes the number pays it in
  its own transaction (completion inside it, as item 12 does).
- **Counters from an app that does not know the posts number** send the terms exactly as before; the
  server keeps the number as it stands. A counter that carries offers or the store is refused.
- **Test fixtures**: every Pay for Content fixture becomes its closest new equivalent (one post, all
  products without offers) and `markShootDone` makes and approves her first post through the real
  routes — the content suites then prove the package as before. Suites that encoded the old rule
  ("a Pay for Content collaboration makes no shoppable posts", "Next" with nothing to post about,
  the exact counter payload) were updated to the rule as it now is, each marked `// Item 21`.

## Caught by the suites, and fixed in the code
- `validateTerms` read `shoppablePosts` but the counter sends `shoppablePostsN` — both spellings now.
- The Entire store's product count used "free from today on" while her picker used "free today"
  — one rule now (today), so "61 products today" and the picker agree.
- The brand's confirm-live notice to the creator now says the final payment also waits for her posts.
