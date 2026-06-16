# 05 — Impact: Category screen rebuild

**Verdict: visual-only, one shared component. Zero functional/data change.**

## Mechanics
- `Packages/Mobile/src/components/vibe/CategoryCircle.js` — inactive tile fill
  `#F1F1F1` → cream (`C.soft`); active state → cream fill + 2px gold ring (was
  solid-gold fill); active label stays gold. No prop/contract change.

## Blast radius
- Shared component → affects the Category screen's sub-category bar AND Home's
  "Browse by Category" row (same component, same source design — intentional,
  consistent).
- Deploy-class: production-impacting (mobile OTA); no backend, no migration, inert
  to `pnpm qa` (web/backend). released=false until founder device-verify.
- Risk: minimal — pure style swap on one component.
