# Workflow Prediction — Offer Engine mockups

> Accompanies the HTML mockups in `04-preview/mockups/`. These mockups are
> **feature-wide** and primarily gate the UI sub-contracts (B = library UI,
> C = campaign-wizard attach). Sub-contract A is backend-only (no UI) — these
> are recorded here as the agreed design the downstream UI contracts implement.

## Screens
- `index.html` — flow map: the 3 channels a library offer flows through.
- `01-offers-list.html` — `/dashboard/offers` library (Sub-contract B).
- `02-offer-builder.html` — create/edit, 5 types, shared `<OfferBuilder/>` (B).
- `03-distribute.html` — Store toggle (offer page) + in-wizard per-influencer
  attach, goal-keyed (Sub-contract C; store-direct path = D).
- `04-store-preview.html` — follower store render + store-direct path (D).

## Predicted user workflow (brand)
1. Brand opens **Offers** (new nav item) → sees the library (or empty state).
2. Clicks **New offer** → builder. Names it, picks one of 5 types, fills the
   per-type config, sets scope (store/category/products) and availing modes.
   Live-preview line updates. Saves (draft or active).
3. **Store distribution:** on the offer, toggles **Publish to Store** → it
   appears in the brand store for all followers; they buy direct (no influencer,
   no commission, no tracking).
4. **Influencer distribution (inside a campaign):** while creating a campaign
   (conversion *or* engagement), at the Offers step the wizard asks "attach an
   offer?" → opens the **offer library picker** → brand **assigns an offer per
   influencer** (same or different per influencer).
   - Conversion → tracked link + commission (`allocation='commissioned'`).
   - Engagement → no commission, no tracking; offer appears on the influencer as
     promotion (`allocation='promotional'`); follower buys store-direct.

## Predicted end states
- A `brand_offers` row exists, reusable across campaigns and the store.
- `published_to_store=true` surfaces it via `resolveBusinessStore()` (D).
- Each per-influencer assignment = a `campaign_influencers` row with
  `brand_offer_id` + snapshotted `offer_config_json` + `allocation` (C).

## Visual fidelity
Locked wave-2 palette (ink `#0A0A0A`, yellow `#FFC107`, success `#10B981`),
Outfit / Plus Jakarta Sans / JetBrains Mono, real dashboard topbar chrome.
Each mockup is self-contained (inline CSS) for standalone preview.
