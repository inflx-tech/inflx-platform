# Feature Spec — Tracking (social half) (influencer · Wave-1 screen 6, final)

> Step 2. The per-collab performance view. Phase-1 social axis only; the
> on-platform axis is a labelled placeholder (Phase-2 backend, gated).

## Problem / goal
The Collabs lifecycle has a **Tracking** stage. Give it a real screen: a per-collab
**performance view** that aggregates the social-post engagement across the collab's live
deliverables (already backed by `deliverable_stats`). The second axis — engagement + sales
on the on-platform post — needs backend that doesn't exist yet, so it's shown as an honest
**"Coming soon (Phase 2)"** panel with no fabricated numbers.

## Scope
**In scope**
- New `CollabTrackingScreen` (IG-clean): loaded by `campaign_influencer_id`.
  - **On social media** panel: aggregate reach/likes/comments/saves/shares/impressions +
    average engagement-rate across the collab's **live** deliverables, plus a per-post
    breakdown row list and a Refresh (re-scrape via `refreshStats`).
  - **On INFLX** panel: a labelled Phase-2 placeholder (post views/engagement + sales) —
    **no fake data**, clearly "coming soon".
  - Empty state when the collab has no live deliverables yet.
- Reach it from `CollabDetail`: the Tracking-stage hero → Tracking; and a "Performance"
  section card on post-sign collabs → Tracking.
- Pure helper `aggregateSocialStats(statsList)` (testable).

**Explicitly out of scope**
- The **platform** analytics + post-level sales attribution (Phase 2 — separate contract,
  needs endpoints + a `post_id` migration).
- Any backend/DB change now.

## Surfaces touched
- App(s): **mobile (influencer) only.** No web, no backend.
- Roles: influencer.

## Data / contracts
- New/changed tables / endpoints: **NONE.** Reuses `getMyCampaignDetail` (deliverables
  list) + `getDeliverable`/`refreshStats` (per-deliverable social stats).
- Money/units/attribution/status: read-only.

## Non-functional
- Auth/role gates: influencer as today.
- Failure modes: a per-deliverable stats fetch failing is skipped (aggregate over what
  loads); no live deliverables → empty state; never fabricate platform numbers.

## Design reference
`04-preview/mockups/tracking-lifecycle.html` §3 (Stage-5 Tracking dual panel; the INFLX
panel already carries the "Phase 2" tag).
