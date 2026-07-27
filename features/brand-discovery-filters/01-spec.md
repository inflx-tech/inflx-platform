# Feature Spec — Brand discovery: live filtering (step 2)

> Step 2 of discovery. Removes the "press Search on every change" friction — the
> directory now filters live (debounced) as you type/adjust. Sliders + pick-from-list
> chips are step 2b.

## Problem / goal
Every filter change (search text, city, niche, tier, ER, ranges) requires an explicit
**Search** button press before results update — slow and clunky. Make the directory
**filter live**: a debounced auto-search fires whenever any filter changes (and on
approval), so results update as the brand types/adjusts.

## Scope
**In scope**
- Replace the initial `[brandStatus]` search effect with a single **debounced effect**
  (≈400ms) keyed on all filter state (query, city, niche, tier, language, useCase,
  min/maxFollowers, minViewEr, min/maxRate, hasCollabs, verifiedOnly, bizOnly, brandHandle,
  sort) — calls the existing `doSearch()`. Same as the tier chips already do.
- Tier chips just set state (the effect auto-searches) — drop their redundant inline
  `doSearch()` (removes a stale-tier double-fetch).
- Keep the Search button + Enter-to-submit (now optional, harmless).

**Explicitly out of scope (step 2b / later)**
- Sliders for the numeric ranges; pick-from-list / autocomplete chips for city/niche/
  language; platform filter; audience-fit filters (backend). Filter-bar IG-clean restyle.

## Surfaces touched
- App: brand-web only (influencers/page.js search effect + tier chips). Roles: brand.

## Data / contracts
- None new. Same `influencerApi.search(params)`; only the trigger changes.

## Non-functional
- Debounce prevents per-keystroke fetch storms; single search source (no double-fetch).

## Design reference
`04-preview/mockups/discovery-card.html` (results; filtering behavior is interaction, not a static mock).
