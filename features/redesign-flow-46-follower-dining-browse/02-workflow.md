# Flow 46 — Workflow

## Governance loop (locked 5-step rhythm)
1. **Audit** — read DiningHome/Browse/Search + LocationHeader; confirm tokens,
   composed atoms, data calls, tracking, render branches. ✅ done (verify-twice).
2. **Mockup** — `design/wave3/flow-46-follower-dining-browse/web.html`, 3 frames. ✅
3. **Green signal** — AskUserQuestion → "Green — incl. LocationHeader". ✅ (mockup_locked)
4. **Implement** — alias import (`brandPalette as lightColors`) + rename mismatched
   tokens per screen (visual only).
5. **After-evidence** — emulator screenshots SKIPPED per founder (dining screens are
   data/login-gated; physical smoke-test covers). After-evidence = mockup + founder
   physical APK smoke-test on live follower v59.
6. **06-diff/notes.md** — plain-English before/after notes.
7. **Web QA** — dual-probe pre-warm → `pnpm qa` → 76/76 GREEN gate 0.
8. **Deploy** — `pnpm publish-ota:all` (brand v96 / influencer v85 / follower v59).
9. **Close-out** — fetch manifest hashes → backfill lock.json → close-out commit
   (`GOVERNANCE_OVERRIDE` on push).

## Per-file token renames (after `brandPalette as lightColors` alias)
- DiningHome: surface→bg2, paper→white, yellow200→yellowPale
- DiningBrowse: surface→bg2, paper→white, yellowDeep→yellowText, border2→muted4
- DiningSearch: paper→white, border2→muted4, success50→successPale, surface→bg2,
  surface2→bg2, yellowDeep→yellowText
- LocationHeader: yellowDeep→yellowText

## Verification
Per-file grep: 0 orphaned `lightColors.{paper|surface|surface2|border2|yellowDeep|
yellow200|success50}` refs. Babel transform PASS for all 4. Existing jest suites
(RestaurantBooking/Cart/Bill) stay green; the pre-existing FollowerWallet vector-icons
load failure is unrelated (flagged separately).
