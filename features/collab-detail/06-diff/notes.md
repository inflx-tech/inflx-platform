# Before / After — Collab detail

**Before:** two detail screens — `OfferDetailScreen` (1251 LOC, pre-sign: terms +
accept/negotiate/decline, heavy goal-branching) and `CampaignDetailScreen` (post-sign:
hierarchy, contract, deliverables, escrow, products). A Collabs row opened one or the
other depending on stage.

**After:** one `CollabDetailScreen` for every stage. IG-clean header (brand · campaign ·
fee/goal) + a 6-node **progress spine** + a **state-driven "next action" hero** + a
stage-gated list of **section cards** (Terms/brief, Contract, Logistics, Deliverables,
Earnings, Products). It orchestrates — heavy actions reuse the existing sub-screens.

## Mockup → build fidelity
Mockup: `04-preview/mockups/collab-lifecycle.html` §3.
- Progress spine + current-stage highlight — **matches**.
- State hero swaps by stage (invite → Accept/Negotiate/Pass; to-sign → Review & sign;
  active → Upload/View; completed → View earnings) — **matches**.
- Section cards lock/unlock by stage (Deliverables/Earnings/Products post-sign;
  Logistics only when `physical_delivery`) — **matches**.

## Action wiring (reuse, not reimplement)
- accept → `acceptOffer(ciId)`; pass → `declineOffer(ciId,{reason})` — inline.
- negotiate → `NegotiationScreen({campaign_influencer_id})`; sign/contract/logistics →
  `ContractScreen({campaignInfluencerId})`; deliverables → `DeliverableList`; earnings →
  `CommissionDetail`; products → `CampaignProducts`.
- CollabsList rows now open **CollabDetail** (was OfferDetail/CampaignDetail).
- Offer notification repointed to CollabDetail (`offer_id === campaign_influencer_id`).

## Known mockup-vs-build deltas (expected, not defects)
1. **Tracking** dual social/platform panels are NOT here (separate contract) — a
   tracking-stage collab shows Deliverables + Earnings.
2. Sub-screens opened from sections are the CURRENT (pre-restyle) screens — IG-clean
   restyle is a later contract.
3. Open-group **applied** is handled inline as a "waiting on brand" hero (no action) —
   simpler than the spec's OfferDetail fallback; no broken path.
4. OfferDetail/CampaignDetail remain registered (deep-link targets); deletion deferred.

## Verification status
- Pure model: `utils/__tests__/collabDetailModel.test.js` — 14 green (heroFor per stage,
  sectionsFor gating, spineFor states).
- Module-load smoke incl. CollabDetailScreen — green.
- Full mobile jest: **66/66 green.**
- Data model verified: `getMyCampaignDetail(ciId)` is status-agnostic (loads every stage);
  returns campaign/deliverables/contract/tranches/product-counts.
- **Pending (device gate):** Maestro flow (open a collab in each stage → correct hero →
  tap a section → correct sub-screen).
