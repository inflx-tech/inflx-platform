# Feature Spec — Campaign Command Center (brand campaign detail redesign)

> Replaces the cramped per-campaign "Manage" view with one master-detail screen that
> holds the full campaign hierarchy and re-surfaces the buried content-review UI.
> Mockup approved in-session 2026-06-20 (founder: "Lock it").

## Problem / goal
The brand's per-campaign screen must hold a deep hierarchy — campaign → sets (each with a
goal) → creators → per-creator deliverables, offer/products, dates, approval, contract,
content, go-live — plus analytics. Today this is split/cramped and the content
view-and-approve UI (campaigns/[id]/reviews) is buried behind a "Manage" view. Goal: a
single calm Command Center where the brand can see status, act on what needs them, review
and approve content, and read performance at three levels.

## Scope
- In scope (brand-web, campaign detail):
  - Master-detail: left hierarchy tree (sets+goals → creators with attention flags),
    right per-creator lifecycle (stage tracker + context action card + deliverables +
    offer/products + window/payout + this-creator performance).
  - Content review surfaced as a first-class action card (approve / request-revision /
    confirm-live), wired to the existing deliverable review endpoints.
  - "Needs action" inbox aggregating content-to-review, contracts-to-sign, negotiations,
    date-change requests across the campaign.
  - Analytics rollup at THREE levels: per-creator, per-set (average ER + totals),
    campaign-total — sales/revenue/commission/ROI + ER/views.
- Out of scope (separate contracts): the dashboard tab merges (E-1/2/3), influencer groups
  (F-5 backend), and the full returns/ledger work.

## Surfaces touched
- App: brand-web (app/dashboard/campaigns/[id]/ and sub-views). Backend: small additive
  endpoints only (see below). No mobile.
- Roles: brand (owner of the campaign).

## Data / contracts
- Mostly RE-WIRES existing data. Confirmed real today (audit 2026-06-20):
  - Stage: campaign_influencers.status, contracts.status, deliverables.status.
  - Deliverables + content: deliverables (submitted_url, live_url, status, revision_count).
  - Payout: escrow_entries tranche_number/status (T1/T2/T3 already pivoted in campaign.controller).
  - Offer/commission: campaign_influencers.offer_type/offer_config_json/brand_offer_id/commission_pct.
  - Engagement analytics: GET /brands/me/campaigns/:id/engagement (totals + by_set + by_influencer).
  - Conversion analytics: GET /brands/me/campaigns/:id/conversions (totals + by_channel + by_influencer).
- New backend (small, additive — each can be its own sub-contract):
  1. Store-clicks rollup endpoint (link_clicks exists; keyed by influencer_id+campaign_id; no aggregate yet).
  2. Per-creator date window + date-change request/approve flow (today only campaign_influencers.posting_date; set-level windows).
  3. Structured per-creator product allocation (today products live inside offer_config_json).
- Explicitly EXCLUDED: reach/impressions tiles — not captured by the scraper; backend deliberately suppresses them. Do NOT render.

## Non-functional
- Auth: brand owns campaign; reuse existing campaign ownership guards.
- Failure modes: zero-state per creator (not live → "no data yet"); analytics endpoints already handle empty sets.
