# Drift — final fixer, area "server" (2 Oct 2026)

Two findings from the final review, both confirmed against the code and reproduced red before the
fix. **No assertion was skipped, deleted or weakened.** Two existing assertions were TIGHTENED
(they matched `/^Store visit /`; they now match the board's full words) — listed below in the
BUILD_RULES format: test file · test name · what it asserted · what it asserts now · frame / decision.

## One line per finding

- **B-1 · frame B4 ("Show 14 creators") · check 5** — What was wrong: in Add creators › All
  creators, the Filters pop-up's yellow button always read "Show 0 creators", because its count
  call (`GET /campaigns/:id/sets/:sid/pickable?…&countOnly=1`) answered 500 — the count answer has
  no rows and the handler mapped over them anyway; the phone prints a failed count as 0. Live
  since item 5, never tested. What changed: one line in
  `backend/src/controllers/invitations.controller.js` (`pickable`) — when the list answered
  without rows, reply `{ tab, total }` and stop. Worked with and Pool always carry rows and are
  untouched. Test: `backend/tests/item5-invitations.test.js` · NEW "the Filters pop-up's count:
  countOnly answers the list's own total — with a filter and without — and no rows" (red before:
  `Expected: 200 · Received: 500`).
- **F-3 · frame F1 (Divya's row) · spec U11** — What was wrong: on the brand's set row an agreed
  store visit read "Store visit Sun 18 Oct, 11:00 am"; the locked frame and U11 say "Store visit
  agreed for Sun 18 Oct, 11:00 am" (her card already said it). Live since 20 Sep, not a
  regression of this build, but an undisclosed departure from the board. What changed: one
  sentence in `backend/src/services/shootPlan.service.js` (`brandLineFor`, stage `agreed`, time
  not passed). The "visit passed with nothing marked" half of that line is untouched. Test:
  `backend/tests/ui-walk-fixes-server-leftovers.test.js` · "the sentence follows the turn…" and
  "the line function alone…" (red before: `Received: "Store visit Wed 7 Oct, 10:00 am"` and
  `Received: "Store visit Sun 18 Oct, 11:00 am"`).

## Assertions tightened (same tests, stricter)

- `backend/tests/ui-walk-fixes-server-leftovers.test.js` · "the sentence follows the turn while the
  time is contested, and only then" · after she accepts, the row line matched `/^Store visit /` ·
  now `/^Store visit agreed for {day}, 10:00 am$/`, and her card's line equals the row's word for
  word · frame F1, U11.
- same test · after he accepts her request to move the agreed time, the row line matched
  `/^Store visit /` · now `/^Store visit agreed for {day}, 3:00 pm$/` · frame F1, U11.
- same file · "the line function alone…" · ADDED: the board's own example composes to exactly
  "Store visit agreed for Sun 18 Oct, 11:00 am", equals her line (`lineFor`), and a passed time
  still reads "The 18 Oct visit passed with nothing marked — send a new time".

Left exactly as it was, and still green: `backend/tests/item10-flow.test.js` · "the brand's
set-detail row says where the visit is…" (`/^Store visit /` at stage `agreed`).

## New test (behaviour that had no test)

`backend/tests/item5-invitations.test.js` · "the Filters pop-up's count…": for six choices (the
default, open-only off, a follower minimum, both, a search, a choice nobody matches) the count call
answers 200 with exactly `{ tab: 'all', total }`, and `total` is the list call's own total; the
call with no `tab` and `countOnly=true` answers the same; it is the number the Creators tab's count
(`/brands/me/discover-creators?countOnly=1`) gives for the same choice; `tab=worked` and `tab=pool`
with `countOnly=1` still answer rows and the set as before.

## Behaviour that moved (for the walk)

- **Add creators › Filters.** Before: the yellow button read "Show 0 creators" whatever was chosen
  (it still applied correctly when pressed). Now it shows the real number, and 0 means nobody
  matches. Server only — an app already on a phone shows the right number as soon as the server is
  deployed; no app update.
- **Set row, store visit with an agreed time (brand).** Before: "Store visit Sun 18 Oct, 11:00 am".
  Now: "Store visit agreed for Sun 18 Oct, 11:00 am" — the frame's words and the creator's. The
  sentence is composed on the server, so older app bundles show it without an update.

## Files touched

- `backend/src/controllers/invitations.controller.js` — the count guard in `pickable` (B-1).
- `backend/src/services/shootPlan.service.js` — "agreed for" in `brandLineFor` (F-3).
- `backend/tests/item5-invitations.test.js` — 1 new test (B-1).
- `backend/tests/ui-walk-fixes-server-leftovers.test.js` — 2 assertions tightened, 3 added (F-3).
- `Packages/Mobile/src/screens/__tests__/actionsStatuses.test.js` — OUTSIDE this area, smallest
  edit: the fixture string on `ROWS.agreed` (one line) now mirrors the server's new sentence. No
  assertion reads that text; the file is 81 of 81 green.

Not done, on purpose: the optional phone hardening in `DiscoverList.js` / `BrandList.js` (throw on
a failed count instead of showing 0). `FiltersSheet` disables its button while the count is
unknown, so a failed count would then block Apply — a behaviour change no frame asks for.

## Tests run

- Server, serially against the test database on 5544 (not started or stopped by this fixer):
  `ui-walk-fixes-server-leftovers`, `item5-invitations`, `item10-flow`,
  `ui-walk-fixes-shoot-turn`, `item6-negotiation` — **5 suites, 116 of 116 passed.** Before the
  fix, with the tests already in place: 3 failed (the three named above), everything else passed.
- Phone, whole suite (`npx jest --silent --maxWorkers=2`), final run: **90 suites, 2082 of 2082
  passed.** (A first run minutes earlier gave 2073 of 2081, the 8 reds all in
  `src/components/remote/__tests__/cancelWhileBusy.test.js` — a new file another fixer was still
  writing in the components area; not touched here, and green on the next run.) The one phone file
  this fixer touched, `actionsStatuses.test.js`, is 81 of 81.
