# Feature Spec — Follower discovery screens on the Section Engine (Phase C2)

> Phase C2 of the Creator Vibe section-engine program. Depends on Phase A
> (engine + endpoints, live) and Phase C (SectionRenderer + Home, verified).
> Umbrella contract for wiring the remaining discovery screens to the engine,
> one at a time, behind per-screen flags (inert until flipped). Design LOCKED
> (SECTION-CATALOG.md + the comprehensive mockups, 2026-06-01).

## Problem / goal
Home now renders from the backend `{ sections }` engine (Phase C). C2 extends the
same proven pattern to the other discovery screens so they too become
admin-controlled, no app update.

## Scope
- **In scope (incremental, per-screen flag, inert):**
  - **Creator Store** (`InfluencerStoreScreen`) → `GET /v1/follower/section/
    creator/:handle` via `<SectionRenderer>`, behind `SECTION_ENGINE_CREATOR`
    (default false). Keeps the existing hero header + search as screen chrome;
    swaps the body (category grid + hot picks) for the engine shelves when on;
    falls back to the existing body on error/empty. **[this increment]**
  - Later increments (same pattern, own flags): Creator's Category, Category,
    Offers (Offers needs `SectionRenderer` extended for hero/chips/grid).
  - `followerApi.getCreatorSections` / `getCreatorCategorySections` (added).
- **Out of scope:** detail templates (Phase D), Orders/Profile (Phase E), reels
  (52.8), the OTA cutover for any screen (gated), `SectionRenderer` hero/chips/grid
  (deferred until the Offers increment).

## Surfaces touched (this increment)
- `Packages/Mobile/src/`: `config/featureFlags.js` (+SECTION_ENGINE_CREATOR),
  `services/api.js` (+getCreatorSections/+getCreatorCategorySections),
  `screens/follower/InfluencerStoreScreen.js` (flag-gated body swap). No backend
  change (Phase A endpoints live). No web.
- Roles: follower.

## Data / contracts
- Consumes Phase A's live `GET /v1/follower/section/creator/:handle`
  (`{ sections:[{ key,title,type,item_type,items:[…+tracking] }] }`).
- No new tables/endpoints. Items carry the 4-ID tracking block from the backend.

## Non-functional
- **Inert on arrival:** `SECTION_ENGINE_CREATOR=false` by default → the Creator
  Store behaves exactly as today; mobile ships only via OTA (not done here).
- **Failure modes:** sections error/empty → existing getStore body renders (never
  a regression); unknown shelf type → skipped by `SectionRenderer`.
- **Gates:** mockup-lock (locked at design), 06-diff notes, `pnpm qa` GREEN,
  Maestro green at any released=true flip (gov-check Rule 5).
