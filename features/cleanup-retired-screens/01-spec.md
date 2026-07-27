# Feature Spec — Cleanup: retire the superseded influencer screens

> Step 2. Deletion-only cleanup after the Wave-1 influencer IA redesign. No new
> UI; removes unreachable code and tidies the navigator.

## Problem / goal
Six Wave-1 contracts replaced the old influencer screens and repointed every route
to the new ones, leaving 7 screen files unreachable. Delete them and remove their
now-dead navigator imports/registrations so the tree reflects reality.

## Scope
**In scope — delete these 7 unreachable screens** (each role owned by a live replacement):
- `OfferDetailScreen.js`      → CollabDetail
- `OfferListScreen.js`        → CollabsList
- `MyCampaignsScreen.js`      → CollabsList
- `CampaignDetailScreen.js`   → CollabDetail
- `CampaignCompletionScreen.js` → CollabDetail (completed state)
- `DeliverableDetailScreen.js`→ unified DeliverableScreen (route already repointed)
- `MyPostsScreen.js`          → CreateScreen
Plus: remove their imports + `Stack.Screen` registrations from `InfluencerNavigator`.
Keep the `Deliverable`/`DeliverableDetail` routes (→ DeliverableScreen).

**Out of scope**
- Any behaviour change; any kept screen; the concurrent `MyStore` work (untouched).
- Backend/DB (none).
- Flipping `released` on v151/v152/v153/v155 — done separately once the founder
  device-confirms.

## Surfaces touched
- App(s): mobile (influencer) only — `InfluencerNavigator.js` + file deletions.
- Roles: influencer.

## Data / contracts
- Endpoints/tables/migrations: NONE. No API touched.

## Non-functional
- **Zero runtime behaviour change** — all deleted screens were already unreachable
  (verified: no live navigation targets them; no kept file imports them).

## Design reference
`04-preview/mockups/nav-inventory.html` — deleted vs remaining screen inventory.
