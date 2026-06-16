# 02 — Workflow: Phase 5b Home Layout

Actor: follower (mobile app). Trigger: opens the Home tab. Engine path is live
(`SECTION_ENGINE_HOME=true`) → Home renders the backend `{ sections }` payload
through `SectionRenderer` + the `components/vibe` card kit.

## Steps (what changes vs current)
1. Follower opens Home → `GET /v1/follower/home` returns shelves (unchanged).
2. `SectionRenderer` renders each shelf:
   - A `hero` offers/mixed shelf → **new cream banner** (was flat gold box).
   - Every shelf header → **cleaner** (title + "View all" only; tag/count gone).
   - A `nav_tiles` shelf → category **circular bubbles** (was rounded squares).
   - product/brand/creator rails → unchanged structure (already palette-correct).
3. `HomeScreenV2` chrome adds a static **Trust band** under the shelves and fixes
   the search filter button's white-on-gold text.
4. "View all" on any list shelf → `SectionResults` (unchanged wiring).

## Non-goals
No change to fetch, item shapes, navigation targets, tracking, or which shelves
appear. No backend/DB/API/migration. Fallback feed (engine-empty safety net)
untouched.

## Proof
`pnpm qa` GREEN gate 0 (zero regression; mobile-only, inert to web/db lanes).
Visual fidelity confirmed against `04-preview/mockups/home-recolored.html` at the
joint 5→6 founder verify (gates `released`).
