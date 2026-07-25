# Feature Spec — Deliverable consolidation (influencer · Wave-1 screen 5)

> Step 2. Merges the two divergent deliverable screens into one, closing a real
> capability gap.

## Problem / goal
There are two single-deliverable screens with different capabilities:
- `DeliverableScreen` ("Deliverable") — **media picker + R2 upload + live stats**, but
  reachable ONLY via a push-notification deep-link.
- `DeliverableDetailScreen` ("DeliverableDetail") — **URL-only submit + 5-step timeline +
  notes-to-brand + confirm dialogs**, the screen in-app taps actually reach.

So the same task looks different depending on how the influencer arrived. Merge into
**one IG-clean screen** with the union of capabilities, reached from every door.

## Scope
**In scope**
- Rewrite `DeliverableScreen` as the single unified screen (IG-clean): status timeline +
  details/brief + submitted-content preview (media OR url) + revision card + **submit
  section with media picker + R2 upload + URL fallback + notes-to-brand + confirm dialog**
  + submit-live (approved) + **live performance stats** + live celebration.
- Load by either `deliverable` object (in-app) or `deliverableId` (notification) via
  `getDeliverable(id)` (returns `{deliverable, stats}`); pull-to-refresh via same.
- Register the unified component under **both** route names `Deliverable` and
  `DeliverableDetail` (in the Collabs + Home stacks) so both existing entry points hit it
  with no caller change.
- Retire `DeliverableDetailScreen` as a route (component file left unused; deleted in the
  later cleanup contract).
- Small pure helper `deliverableStatusMeta(status)` → { label, tone } (IG tones).

**Explicitly out of scope**
- Deleting the `DeliverableDetailScreen.js` file (later cleanup).
- Changing the deliverable submit/live/stats backend (unchanged).
- Any backend/DB change.

## Surfaces touched
- App(s): **mobile (influencer) only.** No web, no backend.
- Roles: influencer.

## Data / contracts
- New/changed tables / endpoints: **NONE.** Reuses `getDeliverable`, `getUploadUrl`,
  `uploadFile`, `getMediaUrl`, `submitDeliverable`, `submitLive`, `refreshStats`.
- Money/units/attribution/status: existing writes only (submit/live) — unchanged.

## Non-functional
- Auth/role gates: influencer as today.
- Failure modes: load-by-id 404 → error state; upload failure → alert, no partial submit;
  each submit/live keeps its 2-step confirm.

## Design reference
`04-preview/mockups/deliverable-unified.html` — submit (upload+URL) + live-stats states.
