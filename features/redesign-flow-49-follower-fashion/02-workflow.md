# Flow 49 — Workflow

## Governance loop (locked 5-step rhythm)
1. **Audit** — read ProductDetail + LookbookDetail; confirm tokens, accent usage,
   availing_modes dispatch, tracking, discount math, APIs. ✅ (verify-twice)
2. **Mockup** — `design/wave3/flow-49-follower-fashion/web.html`, 2 frames + accent rule. ✅
3. **Green signal** — AskUserQuestion → "Green — implement" (accent→ink/yellow). ✅ (mockup_locked)
4. **Implement** — ProductDetail: drop colors/darkColors/getBusinessAccent → P/fonts/
   getBusinessAccentLight; accent reclassified to wayfinding tints; CTA→ink/yellow.
   LookbookDetail: darkColors+hardcoded → brandPalette + FASHION_PALE tints. ✅
5. **After-evidence** — emulator screenshots SKIPPED (deep, data-gated detail screens);
   after-evidence = mockup + founder physical APK smoke-test on live follower v62.
6. **06-diff/notes.md** — before/after notes.
7. **Web QA** — dual-probe pre-warm → `pnpm qa` → 76/76 GREEN gate 0.
8. **Deploy** — `pnpm publish-ota:all` (brand v99 / influencer v88 / follower v62).
9. **Close-out** — fetch hashes → backfill lock.json → close-out commit
   (`GOVERNANCE_OVERRIDE` on push). Stage ONLY my files (Window A shared index).

## Verification (done)
- ProductDetail: 0 `colors.`/`accentDim`/`getBusinessAccent`/`darkColors`/`fmtMoney` refs.
- LookbookDetail: 0 `darkColors`/dark-hex/`#ec4899` refs (only the intentional
  rgba-white floating-back remains).
- Babel transform PASS (2/2).
- Marker grep: availing_modes / dispatchCta / getStoreProducts / getLookbook /
  tracking / nav present (25 occ) — logic untouched.
