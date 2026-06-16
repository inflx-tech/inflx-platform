# 02 — Workflow: Phase 5c Category Flow

Actor: follower. Triggers: taps a Home category bubble → `CategoryList`; opens a
creator's store and drills into a vertical → `CreatorCategory`.

## Steps (what changes)
1. `CategoryList` (per vertical) — renders `SectionRenderer` shelves (already 5b
   styled) with a `CategoryCircle` sub-category bar. No change here beyond removing
   dead pill styles.
2. `CreatorCategory` — the active sub-type chip now shows ink text on its gold
   background (was white). Everything else (vibe cards, navigation, 4-ID tracking)
   unchanged.

## Non-goals
No change to fetch, item shapes, navigation, tracking, or which shelves render.
No backend/DB/API/migration. `FindScreen` untouched (deferred).

## Proof
`pnpm qa` GREEN gate 0. Visual confirmed against the recolored reference at the
joint 5→6 founder verify.
