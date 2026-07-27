# Feature Spec — Brand discovery: range sliders (step 2b)

> Step 2b. Replaces the raw number boxes for the numeric filters with sliders
> that show live values, so a brand can dial in reach / ER / budget by feel.

## Problem / goal
Min/Max followers, Min ER %, and Min/Max rate ₹ are raw `type="number"` boxes — you must
know and type exact figures. Replace them with **sliders showing the current value**
(e.g. "10k+ followers", "ER 3.5%+", "≤ ₹25,000"), which combined with step-2 live
filtering makes tuning results immediate and tactile.

## Scope
**In scope**
- New co-located `FilterSlider` component (label + live value + range input, IG-clean).
- Swap 5 numeric inputs to sliders: Min followers (0–1M), Max followers (0–1M), Min ER %
  (0–15), Min rate ₹ (0–100k), Max rate ₹ (0–100k).
- **Semantics preserved:** a slider at its zero position emits `''` (empty string) so
  `doSearch`'s truthy param gate treats it as "no filter" exactly as an empty box does.
- Sensible steps (followers 5k, ER 0.5, rate ₹1k) so values are round.

**Explicitly out of scope**
- Pick-from-list / autocomplete for city / niche / language (still free text) — needs a
  canonical taxonomy; a later step.
- Platform filter, audience-fit filters (backend batch), filter-bar full restyle.

## Surfaces touched
- App: brand-web only (influencers/page.js filter inputs). Roles: brand.

## Data / contracts
- None. Same params; only the input control changes.

## Non-functional
- Zero-position = no filter (preserves current behavior); debounced live search already
  handles rapid dragging.

## Design reference
`04-preview/mockups/discovery-card.html` (results) — sliders are an interaction change.
