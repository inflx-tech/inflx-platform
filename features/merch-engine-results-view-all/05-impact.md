# Impact — Results page + universal "View all"

**Terse verdict:** One generic backend endpoint (re-runs a shelf's rule with a bigger limit) +
one new mobile Results screen + wiring `onSeeAll` (already supported by ShelfHeader) + threading
surface context into SectionRenderer. No migration, no new ranking. The shared screen also
becomes the Phase-6 banner-gateway/hero-tile target.

## Blast radius
- Backend: 1 route + controller (reuses runRule/taxonomy/sectionLibrary) → Render.
- Mobile: new SectionResultsScreen + navigator entry + SectionRenderer props/onSeeAll + host
  screens pass context + api.js → OTA. Existing shelves render unchanged except a new "See all".

## What could break + mitigation
- *Context not threaded* → "View all" would lose creator/category scope. Mitigated: host screens
  pass context; backend re-applies it (same stacking as the feed).
- *Unknown/odd rule from client* → runRule returns [] (graceful); read-only; parameterized.
- *Large result* → capped at 100 (note shown); no offset pagination in v1 (rules lack OFFSET).
- *Navigator name collision* → `SectionResults` is unused (checked against 28 existing names).
- *Duplicate Stack.Screen name = native crash* → using a unique name; verified.

## Reversibility
- Additive; revert files + re-OTA. The "See all" simply disappears.

## Deploy classification
**Production-impacting** (backend route + mobile OTA) → explicit founder go. UI/Mobile-governed →
mockup-lock + 06-diff. released=false until verified (so Maestro gate not triggered).
