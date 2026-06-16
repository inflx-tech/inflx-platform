# 02 — Workflow: Phase 5d Creator Store

Actor: follower. Trigger: opens a creator's store (`InfluencerStore`).

## Steps (what changes)
1. Creator Store renders profile hero · collabs · category tabs · picks (unchanged
   layout, palette live).
2. The active category tab now shows ink text on its gold background (was white).

## Non-goals
No change to fetch (`getStore`), offers/picks shaping, navigation, or 4-ID
tracking. No backend/DB/API/migration.

## Proof
`pnpm qa` GREEN gate 0. Visual confirmed against the comprehensive creator-store
reference at the joint 5→6 founder verify.
