# Diff notes — item14-sale-going-live

Against the locked board `04-preview/mockups/item14-sale-going-live-mockups-v2.html`.

## What was implemented

Pay for Sale after the shoot, as two paths. **Backend:** `contentGate` admits a new-terms Pay for
Sale collaboration to item 12's content step as Path 2; `saleLive.service.js` adds the rows she
names (`content_social_rows`), the Path 1 view and gate (`path1`, refused with `PATH1_FIRST`),
outside rows, completion (`completeIfDue`, also from item 13's approval hook), the collaboration's
sales from `order_lines`, self-confirmation (`autoConfirmDue`), the six Delayed stages, reminders
and `SALE_MOVE_SQL` for lists. `contentFlow` branches on `aim === 'sale'` for the read
(`shapeSale`), submit, verdict notices, links, posted (stamps `autoconfirm_at`), confirm live (no
money, completion) and reports (three reasons, no creator report). Routes `item14.routes.js`:
`POST/DELETE …/content/social-rows`, `POST …/content/outside-rows`. Migration 199. **Phone:**
`SaleLiveScreen` (hers), `BrandSaleLiveScreen`, `components/sale/{copy14,sheets14}.js`; doors on
both shoot screens (Store Visit and Remote), her Collabs card, the brand's set rows and menu, her
notifications; `influencerApi.saleAddRows / saleRemoveRow / saleAddOutside`.

## What matches the locked mockup
- **S1** — shoot done → "Go live — your posts" (visit and Remote).
- **S2** — set rows: the going-live line, "Your move" chip, "Completed · selling".
- **S3** — the notice names the right step per Aim; Pay for Content's words unchanged.
- **S4/S5** — Path 1 card on top (progress, posts with state chips, create), Path 2 locked with the
  reason, then Open with "Share on social media" as posts are approved.
- **S6/S7** — brand: "INFLX checks" / "You check"; late chip; short-of-minimum line when Delayed.
- **P1** — create opens item 13 at the post type with this collaboration filled in. **P2–P8** are
  item 13's screens, unchanged.
- **S8–S10** — only approved posts offered; the place sheet (six places, Story "proved with a
  screenshot"); rows "post · place"; send; locked with the round.
- **S11–S14** — brand review with post codes; changes sheet with reason; changes asked; last-round
  warning and "Ask for changes — last time".
- **S15–S17** — a link each / Story screenshot; "N links and M screenshots to go"; posted with the
  date it confirms itself; outside posts with "Not shared yet" and the date to add by.
- **S18–S21** — "Confirming completes the collaboration · No money moves…"; live · waiting on
  posts; completed and selling with the sales (hers: orders, sales, you earn, waiting / in wallet;
  brand's: orders · sales, commission, INFLX fee, you receive).
- **S22–S24** — reported, Delayed, confirmed itself, old terms; the report sheet offers only the
  reasons the server accepts at that moment.
- **A1** — the new Platform settings number (no page change).

## Where it differs, and why
- **Thumbnails** in Path 1 lists are a neutral tile; the post's cover URL is sent (`cover`) but the
  phone draws the tile for now — the same as item 13's lists on the older APK.
- **S2 "Copy all post codes"** on the completed brand screen is not repeated there; it stays on the
  set's Posts screen (Level 4), one tap away.
- **After screenshots** (Maestro, on the device) are taken at the phone walk, which waits on a
  production Pay for Sale collaboration on the new terms with its shoot done.

## Test record
- Backend `tests/item14-sale.test.js`: 20/20. Item 12's four suites green, three assertion drifts
  recorded in place.
- Full-run compare (`scripts/compare-tests.js baseline_item14.json after`): before 133 suites / 1757 tests /
  1548 passed / 181 failed → after 134 / 1777 / 1568 / 181. **Newly failing 0.** New 22 (22 passing).
  Gone 2 — both RENAMED by the recorded item 12 drift (Pay for Sale now reaches the step; Hybrid still 404).
- Mobile: 62 suites / 800 tests green, including `saleLiveScreens.test.js` 13/13 and the
  duplicate-screen-name test.
