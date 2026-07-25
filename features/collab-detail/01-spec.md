# Feature Spec — Collab detail (influencer app · Wave-1 screen 2)

> Step 2. Follows features/collabs-list. The unified, state-driven engagement
> hub that replaces BOTH OfferDetailScreen and CampaignDetailScreen.

## Problem / goal
After the list merge, a row still opens one of two different old detail screens
(OfferDetail pre-sign, CampaignDetail post-sign). Replace both with **one
`CollabDetailScreen`** that reads the engagement's stage and shows: a progress
spine, a state-driven "next action" hero, and the standing sections (Terms,
Contract, Logistics, Deliverables, Earnings, Products). One screen for the whole
life of a collab — invite through completion.

## Scope
**In scope**
- New `CollabDetailScreen`, IG-clean, loaded by `campaign_influencer_id` via the
  existing `influencerApi.getMyCampaignDetail(ciId)` (verified status-agnostic —
  works for every stage; returns terms/brief/deliverables/contract/tranches).
- **Progress spine** header (Invite → Negotiate → Sign → Active → Track → Complete),
  current stage highlighted, derived via `utils/collabStages.deriveStage`.
- **State-driven hero** = the one next action for the current stage:
  - invited → **Accept** / **Negotiate** / **Pass** (Accept + Pass = inline API
    calls with confirm; Negotiate → existing `NegotiationScreen`)
  - negotiating → **Open negotiation** → `NegotiationScreen`
  - accepted / pending_influencer → **Review & sign** → existing `ContractScreen`
  - pending_brand / contracted → informational "Signed · waiting for brand" (no CTA)
  - active → **the current deliverable action** → existing `DeliverableList`/`Deliverable`
  - completed → **View earnings** → existing `CommissionDetail`
- **Section cards** (shown per stage, each opening the existing sub-screen):
  Terms/brief · Contract (→ Contract / ContractPdf) · Logistics (only if
  `physical_delivery` — opens the production coordination that today lives inside
  ContractScreen) · Deliverables (→ DeliverableList) · Earnings (→ CommissionDetail)
  · Products (→ CampaignProducts).
- Route `CollabsListScreen` rows to **CollabDetail** (replacing the strangler routing
  to OfferDetail/CampaignDetail). Repoint notification/Home deep-links that opened
  those detail screens to CollabDetail.

**Explicitly out of scope (later contracts)**
- Restyling the sub-screens (Negotiation / Contract / Deliverable) to IG-clean.
- The **Tracking** dual-panel detail (social + platform) — its own contract
  (Wave-1 screen 6 / Phase-2 backend). A tracking-stage collab here just shows its
  Deliverables + Earnings sections.
- **Deleting** OfferDetailScreen / CampaignDetailScreen (kept registered for
  transitional deep-links; a later cleanup contract removes them).
- Open-group **application** variant nuances → transitionally still handled by
  routing that specific case to the existing OfferDetail (documented in workflow).
- **Any backend or DB change.**

## Surfaces touched
- App(s): **mobile (influencer) only.** No web, no backend.
- Roles: influencer.

## Data / contracts
- New/changed tables / migrations: **NONE.**
- New/changed endpoints: **NONE.** Reads `getMyCampaignDetail(ciId)`; actions reuse
  existing endpoints — `acceptOffer` / `declineOffer` (POST /me/offers/:id/*),
  negotiations, contracts, deliverables, commission — unchanged.
- Money/units, attribution, status machine: **read + existing writes only** (accept/
  decline/sign/submit already exist); no new state transitions.

## Non-functional
- Auth/role gates: influencer auth as today.
- Failure modes: `getMyCampaignDetail` 404/invalid-id → clean error state + back;
  a stage with no action → hero shows an informational status, never a dead button;
  action failures surface the API error message, no optimistic corruption.

## Design reference
`04-preview/mockups/collab-lifecycle.html` — Section 3 (the state-driven detail:
To-Sign / Active states + the fixed skeleton).
