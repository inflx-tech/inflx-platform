# Feature Spec — Brand Home restyle (IG-clean, step 1 of the screen-body restyle)

> Continues the shell work: the brand tab bar is already IG-clean; now the first
> screen a brand sees.

## Problem / goal
The brand Home quick-actions used a **mixed emoji + glyph** icon set (🧾📅🏷📊🤝 alongside
⊟◫✉₹★⚙) on solid **yellow circles** — inconsistent with the IG-clean system now used by the
influencer app and the brand tab bar.

## Scope
**In scope**
- Replace all 11 quick-action icons with **MCI vector icons**.
- Quick-tile icon container → neutral IG tile (38px rounded square, soft grey) instead of a
  30px solid-yellow circle; label 11 -> 12px in the IG ink colour.

**Out of scope (next slices)**
- The rest of the Home body (hero, action-required card, wallet alert, campaign cards) and
  the other brand screens (Campaign list, Campaign detail body) — separate slices so each
  stays reviewable.

## Surfaces touched
- Mobile (brand) only — OTA. Presentation only; no data or navigation change.
