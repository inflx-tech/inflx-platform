# 06 — Before / after notes

**Before** = the locked generic-rule mock `04-preview/mockups/banner-rule.html`.

**After** = the live App Builder image-tile editor with the inline "When tapped, show
products where…" rule form (Under ₹ · Min % off · Brand · tags · has-offer), and the
backend brand condition + inline-rule tap path. Capture pending Vercel admin deploy +
OTA + founder live-test (no Maestro device; `release.released` false per precedent).

## What the implementation delivers vs the mock
- Per-banner generic rule (all conditions optional; brand just one of them) — matches.
- New backend brand-label condition on `facets.brand` (case-insensitive) — the one
  missing condition; the rest (price/discount/tags/has-offer) already existed.
- Tap runs the inline rule scoped to the banner's world — matches.
- Frame STYLES (named looks/countdown/mosaic) intentionally NOT in this contract —
  they ride the later design pass (engine-first).

## Verification
- Backend: `category_nodes`+`library_products` load clean; brand clause reloads ok.
- `pnpm qa` GREEN 79 · brand-web `npm run build` exit 0 · mobile jest 20/20 (baseline
  suite unchanged) · SectionRenderer/SectionResults/api babel-compile clean.
- Live founder test on OTA/Vercel = final sign-off (verified inline rule against the
  Phase-1 demo data: brand=Nike+40%, price_max).
