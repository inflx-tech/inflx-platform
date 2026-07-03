# Before/after diff — app-builder-wizard (P2)

**Before** = the founder-locked mockups in `04-preview/mockups/` (00-all-screens.html
combined view reviewed + locked 2026-07-03).
**After** = real screenshots captured by the e2e walkthrough against local
brand-web + local backend + real admin JWT: `06-diff/after/01…05.png`
(shelf list · wizard step 1 Design · step 2 Content · step 3 Display ·
step 4 Action).

## Plain-English differences vs the locked mockups
- Wizard is a centered overlay on the EXISTING App Builder page (kept its
  header/Publish/scope pickers) rather than a standalone screen — the mockups'
  dark-overlay modal intent, same four steps, same business names.
- Step 2 shows the three Content kinds as stacked expandable cards (Automatic /
  My rule / My images) instead of side-by-side tabs — reads better with the
  inline rule builder open; wording identical.
- Step 3 placement panel shows "Items" count (the addition the founder approved
  when locking: item_limit surfaced in Display).
- Step 1 keeps the amber/gray admin theme (existing page palette) rather than
  the mockups' neutral grays; catalog contents, grouping, names, and P3-greyed
  cards match 1:1.
- Sale-zone countdown: the wizard's Display step offers "show a countdown
  (uses the same end time)" gated on ends_at being set — the honest-timer
  behavior from P1, exactly as mocked.

## Verification evidence (2026-07-03, local e2e, real JWT + real DB)
14/14 workflow assertions green (scratchpad wizard-walkthrough.mjs):
wizard create flow steps 1→4 · P3 designs not selectable · schedule window
chip · PUT 200 carrying starts_at/ends_at + config_json.design ·
"Live until" row chip · no dead/offer-gated rules in pickers (P1-CLEAN) ·
edit-in-wizard resolves design + round-trips rule/schedule/design ·
follower payload regression (baseline 7 sections unchanged) · in-window
wizard shelf served to followers · cleanup verified (0 QA rows left).
Plus: existing admin web suite 46/46 green against the rebuilt page;
full `pnpm qa` run recorded in lock.json.
