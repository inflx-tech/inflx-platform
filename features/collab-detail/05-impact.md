# Impact — Collab detail

## One-line verdict
**Frontend-only, mobile-influencer, OTA — zero backend/DB.** (Mechanics below.)

## What changes
- Adds `CollabDetailScreen` + small pure helpers (`heroFor`, `sectionsFor`).
- Edits `CollabsListScreen.openCollab()` → route to `CollabDetail` (was OfferDetail/
  CampaignDetail).
- Registers `CollabDetail` in the Collabs stack; repoints notification/Home deep-links
  that opened OfferDetail/CampaignDetail to CollabDetail.
- Reuses existing sub-screens (Negotiation/Contract/Deliverable/Commission/Products)
  unchanged — CollabDetail orchestrates, it does not reimplement their logic.

## Blast radius
- No API added/changed; single read via `getMyCampaignDetail`; actions reuse existing
  endpoints.
- No native modules → **OTA only, no APK rebuild.**
- OfferDetail/CampaignDetail remain in the bundle (transitional deep-link targets);
  deletion deferred to a cleanup contract.

## Risks & mitigations
- **Stage→hero correctness** (wrong action for a stage) → pure `heroFor` + unit tests
  covering every stage.
- **Data availability pre-sign** — mitigated: `getMyCampaignDetail` verified
  status-agnostic (returns terms/brief for invited rows too).
- **Open-group applied** edge → transitional carve-out routes it to OfferDetail.

## Release classification
**Production-impacting via OTA** → surfaced for explicit founder go at deploy; build +
commit deploy-inert until OTA publish. Maestro gate per Rule 5 (founder may skip on
explicit call, recorded).
