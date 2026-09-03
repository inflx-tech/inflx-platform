# Before / after — pass 4

## Screenshots

**Not applicable.** No code changed and no screen exists for any of it.

## What was implemented

| | Before | After |
|---|---|---|
| The visual design system | 74 records — moods, palettes, type styles, 24 shop themes — read by nothing | **Gone**, exported first |
| Retired empty tables | 5 more, referenced by nothing | Gone |
| Everything the product uses | — | **Untouched and verified** |

## The guard that mattered

The first run **rolled back entirely**. `design_presets` had a dependent object, and the
script deliberately refuses `CASCADE` — so instead of silently destroying whatever
depended on it, the whole transaction aborted and nothing was dropped.

Chasing that down found two things:

1. **`experience_themes`** — the 24 shop themes, which I had not even listed. They hung
   off `design_presets`. So the design system was 74 records, not the 85 I had quoted
   from an earlier inventory.
2. **`experience_templates` is referenced by `section_config`** — the live table holding
   the shelves your shopper app renders. It was excluded. Its single row stays.

Without the no-CASCADE rule, the first run would have "succeeded" and taken a live
constraint with it.

## What to check

Nothing on a device. The evidence is the row counts above, taken straight after the drop.

## Known, and not fixed here

Twenty retired tables remain, plus `experience_templates`. They are inert. Dropping them
means first removing code that kept features still stand on — which is a product
decision (see the pitching question), not a cleanup one.
