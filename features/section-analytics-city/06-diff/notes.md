# Before/after diff — section-analytics-city (P5)

**Before** = 04-preview/mockups/00-analytics-city.html (locked via founder's
blanket P4+P5 completion delegation).
**After** = 06-diff/after/01-city-stack.png (builder editing the QA_CITY
stack via the city-override input) + 02-analytics-panel.png (📊 last-7-days
panel showing real recorded events).

## Differences vs mockup
- City input sits inline after "⚙ Manage worlds" with an Enter-to-commit +
  "editing the CITY stack" chip + "✕ back to worlds" — mockup intent, builder
  idiom. Analytics panel matches (table + honest-counting footnote); the bar
  column was dropped (table reads fine without it).
- Engine reality delivered: loadConfig now merges global < vertical < CITY —
  previously city rows existed in schema but NO follower call path could ever
  merge them (verify-twice finding recorded in the spec).

## Verification (2026-07-03, local e2e — 14/14)
- City: stack saves under scope_type=city · city follower gets ADDED section ·
  same-shelf_key row REPLACES the world row for that city · other followers
  byte-identical to baseline · builder loads/edits the city stack.
- Events: taps + see_all → 204 + rows; junk event → 204 + NO row; analytics
  rollup = exactly 2 taps + 1 see_all + unauth 401; 📊 panel renders them.
- Mobile emit: SectionRenderer taps/see-all/tiles/creators wired via
  fire-and-forget followerApi.recordSectionEvent (babel clean, jest 25/25).
  NOTE (honest record): the emit wiring's replace-all initially clobbered the
  exported goToOffer/goToProduct/goToBrand definitions + two component scopes
  (HeroOffer/OfferGrid) — caught by self-audit before any commit, restored,
  and the two components now take an onOfferTap prop with a safe default.
- Full pnpm qa recorded in lock.json.
