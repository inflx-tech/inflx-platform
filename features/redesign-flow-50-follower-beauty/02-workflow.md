# Flow 50 — Workflow

## Governance loop (locked 5-step rhythm)
1. **Audit** — read SchemaDetail + SalonDetail; confirm section renderers,
   __action_dispatch, Path-B tracking, cfg.accent usage, orderable gate. ✅ (verify-twice)
2. **Mockup** — `design/wave3/flow-50-follower-beauty/web.html`, 2 frames + accent decision. ✅
3. **Green signal** — AskUserQuestion → "Green — implement" (brand ink/yellow spine). ✅ (mockup_locked)
4. **Implement** — SchemaDetail: brandPalette + accent→yellowText/accentDim→yellowPale;
   deal strip yellowPale + yellow avatar + ink/yellow badge; CTA ink/yellow; hero bg2;
   all dark hexes → brandPalette. SalonDetail re-export untouched. ✅
5. **After-evidence** — emulator screenshots SKIPPED (deep, data/template-gated engine);
   after-evidence = mockup + founder physical APK smoke-test on live follower v63.
6. **06-diff/notes.md** — before/after notes.
7. **Web QA** — dual-probe pre-warm → `pnpm qa` → 76/76 GREEN gate 0.
8. **Deploy** — `pnpm publish-ota:all` (brand v100 / influencer v89 / follower v63).
9. **Close-out** — fetch hashes → backfill lock.json → close-out commit
   (`GOVERNANCE_OVERRIDE` on push). Stage ONLY my files (Window A shared index).

## Verification (done)
- 0 dark-hex / `cfg.accent` / `#fff` / `#000` refs in SchemaDetail (only the
  intentional rgba-white floating-back remains).
- Babel transform PASS (SchemaDetail + SalonDetail).
- Marker grep: __action_dispatch / handleViewBrand / BrandStore nav / detail_sections /
  cta_primary / orderable present (18 occ) — logic untouched.
