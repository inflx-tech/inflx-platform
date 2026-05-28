# Flow 44 — Workflow

## Governance loop (locked 5-step rhythm)
1. **Audit** — read EnquiryScreen + MyReturnsScreen; confirm tokens / API /
   tracking / navigation. ✅ done (verify-twice).
2. **Mockup** — `design/wave3/flow-44-follower-enquiry-returns/web.html`, 4 frames. ✅
3. **Green signal** — AskUserQuestion → founder "Green — implement". ✅ (mockup_locked)
4. **Implement** — token-swap each screen to light brandPalette (visual only).
5. **After-evidence** — emulator screenshots SKIPPED per founder ("Green — implement"
   chose the skip path; lead/returns are login/data-gated, like Flow 42/43).
   After-evidence = founder physical APK smoke-test on live follower v57.
6. **06-diff/notes.md** — plain-English before/after notes.
7. **Web QA** — dual-probe pre-warm → `pnpm qa` → 76/76 GREEN gate 0.
8. **Deploy** — `pnpm publish-ota:all` (brand v94 / influencer v83 / follower v57).
9. **Close-out** — fetch manifest hashes → backfill lock.json release block →
   close-out commit (`GOVERNANCE_OVERRIDE` on push).

## Token-swap plan per screen
- **EnquiryScreen** (`colors` navy): container bg → P.bg; navyDeep header → ink
  hero (white title, mono sub/back); orangePale offer banner → yellowPale offer
  strip (mono label, Outfit title, ink/yellow % OFF badge); white form card stays;
  field labels t2 → mono muted2 uppercase; inputs border2 → muted4, t1 → ink/mono;
  orange submit → ink bg + yellow text; teal success → yellow check-tile + ink
  check, teal Done → ink/yellow Done.
- **MyReturnsScreen** (`darkColors` + hardcoded): container/center bg2 → P.bg;
  header → ink hero (white title, mono count); rows `#0D1D2E` → white + P.border;
  thumb `#142438` → P.bg2; text rgba-white → ink/muted; STATUS_THEME → brandPalette
  pales (pale bg + dark text); refund amount → mono successText; admin-notes amber
  box → yellowPale; empty rgba-white → ink/muted; spinner + refresh tint amber →
  P.ink (matches FollowerWallet precedent).

## Verification (post-restyle grep)
EnquiryScreen: 0 `colors.*` refs; `submitEnquiry` + tracking IDs + `inflx_user`
pre-fill intact. MyReturnsScreen: 0 dark-hex / `darkColors.*` / rgba-white refs;
`listMyReturns` + `fmtRupees` + STATUS_THEME keys intact. Babel transform PASS.
