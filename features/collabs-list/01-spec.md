# Feature Spec — Collabs list (influencer app · Wave-1 pilot)

> Step 2 of the contract-driven workflow. Written and agreed BEFORE any code.
> Part of the influencer/brand IA redesign program (see auto-memory
> `project_influencer_app_ia_redesign`). This is the FIRST build slice and
> doubles as the Instagram-clean RN design-system pilot.

## Problem / goal
The influencer app splits one brand engagement across **two tabs** — Offers and
Campaigns — both backed by the same `campaign_influencers` record. A deal in the
`accepted / contracted / active` window legitimately appears in **both** tabs, and
each routes to a different detail screen. Merge them into **one staged "Collabs"
pipeline tab** so a deal is one row that moves through stages, and the app always
shows the next action ("whose turn is it?").

Secondary goal: establish the **Instagram-clean RN design kit** (white/black,
hairline dividers, yellow = your turn) that every later influencer + brand-mobile
screen reuses.

## Scope
**In scope**
- New `CollabsListScreen`: one list over the influencer's engagements, deduped to
  one row per `campaign_influencer_id`, with stage filters derived from
  `influencer_status`: **All · Invites · Applied · Negotiating · To sign · Active ·
  Tracking · Completed · Archive**.
- "Whose turn" flag (you / brand) derived **client-side** from status.
- IG-clean RN design-kit foundation extracted here for reuse: tokens + shared
  components (`ScreenHeader`, `StageTabs`, `CollabRow`, `StatusDot`, `PrimaryCTA`).
- Bottom tab bar: **replace the Offers + Campaigns tabs with a single Collabs tab**
  (IG-clean white bar). Home / Earnings / Profile unchanged this contract.
- **Transitional routing (strangler):** a row taps through to the EXISTING detail
  screens — `OfferDetail` for pre-sign statuses, `CampaignDetail` for post-sign —
  until `CollabDetail` lands (next contract). No detail screen is rebuilt here.
- **Compat:** repoint any navigation that currently targets the `Offers` /
  `Campaigns` tabs (notification `getNavTarget`, Home attention tiles) so nothing
  dead-ends after the tabs are merged. Keep `OfferList` / `MyCampaigns` components
  registered (in the Collabs stack) so existing `navigate('Offers'|'Campaigns',…)`
  calls still resolve during transition.

**Explicitly out of scope (later contracts)**
- `CollabDetail` unified state-driven screen.
- Deliverable-screen consolidation, Create tab, Home restyle + single "Your turn (N)"
  tile, the Tracking screen.
- Deleting the old `OfferListScreen` / `MyCampaignsScreen` (a later cleanup contract,
  after `CollabDetail` is verified live).
- **Any backend or DB change.**

## Surfaces touched
- App(s): **mobile (influencer) only.** No web, no admin, no backend.
- Roles involved: influencer.

## Data / contracts
- New/changed tables / columns / migrations: **NONE.**
- New/changed API endpoints: **NONE.** Reuses `influencerApi.getOffers(statusFilter)`
  and `influencerApi.getMyCampaigns(status)`. No request/response shape change.
- Money/units, attribution IDs, status machines: **read-only** over the existing
  `campaign_influencers.influencer_status` machine; no writes changed.

## Non-functional
- Auth/role gates: influencer auth exactly as today.
- **Correctness requirement (core):** because the two source calls overlap in the
  `accepted / contracted / active` window, the merged list MUST **dedupe by
  `campaign_influencer_id`** and derive the single canonical stage from
  `influencer_status`. No engagement may appear twice.
- Failure modes: one source call fails → render the other + non-blocking error, no
  crash; empty filter → canonical empty state; terminal statuses
  (`declined / expired / rejected_by_brand / slots_filled / cancelled / walked_away`)
  appear only under **Archive**.

## Design reference
`04-preview/mockups/collabs-ia.html` (tab bar + Collabs list) and
`04-preview/mockups/collabs-lifecycle.html` (stage spine + the row in every state).
These are the founder-iterated, Instagram-clean, locked look.
