# Impact — Phase 5a (palette foundation)

**Terse verdict:** Follower-only palette retune (shared `creatorVibe` tokens) → whole app turns
gold/cream/ink in one reviewable step, plus ink-text fixes on shared/Home-reachable gold
buttons. No backend, no migration, no brand/influencer/web change. Color-only; reversible.

## Blast radius
- `theme/tokens.js` (follower-scoped creatorVibe) + 6 component/screen text-color lines. OTA.
- Every follower screen recolors (they share the tokens). brandPalette / brand-web untouched.

## What could break + mitigation
- Residual white-on-gold on non-Home screens (Deals chips, Me, Restaurant, Order tabs,
  Category/CreatorCategory chips, ErrorBoundary) — KNOWN, listed; swept in each screen's flow.
- Gold-as-text on white (low contrast) avoided — gold used as bg(+ink text)/border/badge, not small text.

## Deploy classification
Production-impacting (mobile OTA) → explicit founder go. UI/Mobile-governed → mockup-lock + 06-diff.
released=false until visual verify. No Maestro (released stays false).
