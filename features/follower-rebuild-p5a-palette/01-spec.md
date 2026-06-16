# Feature Spec — Follower app gold/cream palette foundation (Phase 5a)

> Phase 5 visual rebuild, step 1. Establish the locked INFLX gold/cream/ink palette
> across the follower app, verified on Home. UI/Mobile-governed (OTA). No backend, no migration.
> Locked reference: founder's recolored mockups (04-preview/mockups/home-creator-recolored.html, home.html).

## Problem / goal
The follower app runs on the old "Creator Vibe" palette (cream + terracotta-brown primary).
The locked target is **gold #F6B11E primary, cream #FBEFD0, white canvas, ink #1A1A1A,
terracotta #D9663C reserved for sale, Georgia serif hero** — per the founder's recolored
mockups. **Goal (5a):** retune the shared `creatorVibe` token set to the gold/cream palette
(re-skinning the whole follower app at once, since every screen reads these tokens) and fix
text contrast where gold became a button background (mockup: gold button → INK text).

Decision (founder 2026-06-15): establish the palette THROUGH the Home flow so it's visually
verified on the richest screen before propagating; Home *layout* polish (hero/carousels to the
mockup) = the next step (5b).

## Scope
- **In scope:**
  - `theme/tokens.js` `creatorVibe`: brown→gold (#F6B11E), brownDark→#E8A200, surfaces→
    white/cream, ink #1A1A1A, muted #6B6B6B, offer→terracotta #D9663C, story rings→gold;
    add `gold`/`goldDeep`/`cream`/`onGold` aliases. (Key `brown` kept to avoid churn; value now gold.)
  - **Text-on-gold contrast fixes** for shared + Home-reachable surfaces: SectionRenderer hero,
    Reels FAB (icon+label), RankBadge, StoryCircle follow, ProductDetail primary CTA,
    InfluencerStore follow — flipped white → ink (`onGold`).
- **Explicitly out of scope (this step):**
  - Home LAYOUT polish (hero band, carousels, exact structure to the mockup) → **5b**.
  - Per-screen CTA/chip text sweeps on non-Home screens (Deals tab chips, Me wallet/buttons,
    Restaurant detail CTA, Order tabs, Category/CreatorCategory chips, ErrorBoundary) → done in
    each screen's own flow (a few active-chip/CTA spots may still show white-on-gold until then —
    listed in 06-diff). 2.5c cleanup (aliases/schema stubs/legacy screens) → later in Phase 5.
  - Brand/influencer apps + brand-web (this is the follower app only — `creatorVibe` is
    follower-scoped; brandPalette untouched).

## Surfaces touched
- Mobile follower only (`theme/tokens.js` + a few shared components/screens). No backend, no migration.

## Data / contracts
- None. Pure styling token + color values.

## Non-functional
- **Contrast**: every gold background that carries text uses ink (`onGold`) — swept for shared +
  Home-reachable surfaces here; remaining per-screen spots tracked for their flows.
- **Reversibility**: revert token values + the handful of text-color lines.
- **Deploy**: mobile OTA (follower). released=false until founder visually verifies on Home.
  No Maestro (not flipping released).
