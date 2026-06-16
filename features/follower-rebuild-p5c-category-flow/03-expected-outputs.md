# 03 — Expected Outputs: Phase 5c Category Flow

## Visual
- `CategoryList`: clean shelf headers + circular sub-category bubbles (from 5b);
  no dead pill styling; gold-active sub-cat circle with ink/gold label.
- `CreatorCategory`: active sub-type chip = gold background with **ink** text
  (no white-on-gold).

## Functional (unchanged — must hold)
- Category bubble → `CategoryList`; vertical drill → `CreatorCategory`.
- Pick tap → ProductDetail with the creator's 4-ID tracking.
- Sub-category filtering, "View all" → SectionResults unchanged.

## Gate
- `pnpm qa`: 79/79 GREEN, gate 0. No backend/DB/migration.
