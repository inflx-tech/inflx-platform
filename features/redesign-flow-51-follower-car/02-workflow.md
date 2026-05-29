# Flow 51 — Workflow

## Governance loop (locked 5-step rhythm)
1. **Audit** — read CarDetail + CarBooking; confirm tokens, Razorpay, prebookDateRange,
   tracking, sign-in gate, pricing tabs, dual CTA. ✅ (verify-twice)
2. **Mockup** — `design/wave3/flow-51-follower-car/web.html`, 2 frames. ✅
3. **Green signal** — AskUserQuestion → "Green — implement". ✅ (mockup_locked)
4. **Implement** — both screens hardcoded-dark → brandPalette; CAR_PALE hero/img tints;
   amber → ink/yellow; gold stars; successText discounts; ink hero on CarBooking. ✅
5. **After-evidence** — emulator screenshots SKIPPED (deep, payment/data-gated);
   after-evidence = mockup + founder physical APK smoke-test on live follower v64.
6. **06-diff/notes.md** — before/after notes.
7. **Web QA** — dual-probe pre-warm → `pnpm qa` → 76/76 GREEN gate 0.
8. **Deploy** — `pnpm publish-ota:all` (brand v101 / influencer v90 / follower v64).
9. **Close-out** — fetch hashes → backfill lock.json → close-out commit
   (`GOVERNANCE_OVERRIDE` on push). Stage ONLY my files (Window A shared index).

## Verification (done)
- 0 dark-hex/`#F59E0B`/`darkColors` refs in either screen (only intentional rgba-white
  floating buttons + white-on-ink CTA sub remain).
- Babel transform PASS (both).
- Marker grep (CarBooking): processPayment / prebookDateRange / prebookDateRangeVerify /
  campaign_influencer_id / inflx_token / Math.round(advanceRupees) present (7 occ).
