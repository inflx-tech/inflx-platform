# Feature Spec — follower-home-stories-listing

> Backend + section_config. Fixes the founder-reported "Home influencer stories
> carousel is missing". Companion to `follower-listing-driven-discovery` (same
> offer-independent philosophy, now applied to Home Stories).

## Problem / goal
Home's Stories carousel is empty. Verified vs prod: the `stories` rule is
offer/follow-gated (`liveOfferExistsForInfluencer` OR a follow), but prod has
**0 campaign_offers** (offer intent lives at set level as `coupon_prefix`, never
materialized) and **0 follows** → 0 stories. Creators ARE active — Sagar Joshi has
**9 picks** and is **contracted on 5 active campaigns** — which is why he appears
on the Category screen (picks-based rule) but not on Home.

Make Home Stories **listing/activity-driven** so active creators appear without a
materialized offer — the same fix already applied to Category discovery.

Role: **follower**.

## Scope
- **In scope**
  - New rule `creators_listing` in `sectionRules.service.js`: a creator shows when
    followed OR has a live offer OR has **picks** on active products of approved
    brands. `has_live_deal` (real live offer) still drives the ● LIVE ring.
  - Migration **090**: re-point the Home `stories` shelf rule → `creators_listing`
    (UPDATE-only, idempotent) + refresh its caption.
- **Explicitly out of scope**
  - The offer-source materialization (set-level coupon → campaign_offers) — Phase 3.
  - Any app/mobile change (the app already renders the creators shelf).
  - Other screens' creator shelves (Category already listing-driven).

## Surfaces touched
- Backend `backend/src/services/sectionRules.service.js` (new rule) + migration
  `090_home_stories_listing.sql` (prod `section_config` UPDATE).
- No mobile change. No new endpoint.

## Data / contracts
- New rule registered as `creators_listing`. No schema/DDL change.
- Migration 090 re-points one row (`screen='home', shelf_key='stories'`). Reversible
  (set rule back to `stories`).

## Non-functional
- Backend-first: a creator appears only on real signal (follow / live offer / real
  pick). ● LIVE only when a real `campaign_offers` live row exists (none today → no
  fake LIVE). City = soft boost.
- Defensive: rule failure → [] (a broken shelf never 500s the feed; engine wraps).
