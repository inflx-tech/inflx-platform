# 01 · Spec — Flow 7 / brand-web campaign creation wizard

## What this flow is

The brand-side wizard for creating + publishing a campaign. Single Next.js
route, single file: `Packages/brand-web/app/dashboard/campaigns/new/page.js`
(2570 LOC today).

## Scope

**Pure visual + UX restructure.** The wizard structure stays 3-step
(Campaign → Deliverable sets → Review & publish). The 11 backend
endpoints stay identical. Every field name + every request body stays
identical. The locked wave2 palette + accordion-set layout replace the
dark wave1 palette + tabbed-set layout.

## Why now

This is the founder's original wave2 reference target ("the calmer Step 2
mockup that established the whole design system"). It's also the last
big brand-side surface still on the dark wave1 palette
(`--bg:#0D1117 --orange:#F47920 --gold:#FFB800`) — Flows 1-6 have
already swapped every other brand-web + brand-mobile surface to the
locked light palette.

## Step layout (preserved 3-step)

**Step 1 — Campaign basics**
- name (text)
- start_date (date · min = today+7)
- end_date (date · min = start_date)
- total_budget (rupees · engagement+hybrid only)
- allow_negotiation (bool)
- live remaining-budget strip if total_budget > 0

**Step 2 — Deliverable sets** *(the dense one — full restyle)*
Vertical accordion of sets (replaces tabbed sets). First set auto-open;
others collapsed by default. Pinned campaign budget strip at top.
Each set body contains 12 sub-sections in 4 grouped panels:

| Panel | Sub-sections |
|---|---|
| Identity | name · goal (3-card: conversion / engagement / hybrid) |
| Schedule & money | content window (start/end dates) · set_budget (handpick + engagement/hybrid only) · coupon_prefix (conversion/hybrid only) |
| Content brief | formats (chip multi-select + per-format counter) · brief (textarea) · brand assets (gallery picker) |
| Influencers | mode toggle (Handpick / Open group) · branch UI below |

Handpick branch:
- Saved groups (chips, localStorage)
- "Add influencers" button → opens **side drawer** with Browse panel
  (search · filters: niche/tier/city/min-followers/max-followers/min-ER ·
  paginated grid of creator cards · "Add N · Invite M" footer for
  selected mix of onboarded + scraped creators)
- List of added influencer rows below the button
- Each row's "Configure offer" → opens **side drawer** with 5 offer-type
  sub-forms (Discount · Volume · BOGO · Bundle · Free gift) +
  fee/commission/post-date/physical-delivery/custom-coupon

Open-group branch:
- Group params form: tiers · niches · cities · min_er · gender · max_cap ·
  per_influencer_budget
- Same offer drawer for group offer

Set footer actions: Duplicate set · Delete set (disabled when last).
"+ Add set" button at bottom of accordion list.

**Step 3 — Review & publish**
- Campaign header (name + dates + budget strip)
- Per-influencer / per-group allocation breakdown
- One review card per set with grouped key/value rows
- Publish button (disabled when budget over)

## Sticky right rail (NEW)

Visible across all 3 steps:
- Live step counter (1/3 · 2/3 · 3/3)
- Live state summary: N sets · M influencers added · ₹X of ₹Y allocated
- Status flags (e.g. "1 set missing window", "Group has no tiers")
- "Save draft" button
- Step-appropriate primary button (Build sets → / Review → / Publish 🚀)

## Backend audit — verified-twice (zero phantom fields)

| Field group | Endpoint | Status |
|---|---|---|
| Campaign top-level (name, dates, total_budget, allow_negotiation) | `campaignApi.create / update` | real ✓ |
| Set (name, goal, mode, window, set_budget, brief, coupon_prefix, formats, assets) | `campaignApi.createSet / updateSet` | real ✓ |
| Handpick per-influencer (influencer_id, post_date, influencer_budget, offer_type + sub-fields, commission_pct, physical_delivery, delivery_address, custom_code) | `campaignApi.inviteInfluencer / updateInfluencer` | real ✓ |
| Open-group params (tiers, niches, cities, min_er, gender, max_cap, per_influencer_budget) | sent as `group_params` JSON on set | real ✓ |
| Brand context (wallet_balance, platform_fee_pct, products) | `brandApi.getMe / getProducts` | real ✓ |
| Influencer search (paginated grid + unclaimed/scraped support) | `influencerApi.search / campaignApi.searchInfluencers` | real ✓ |
| Scraped-creator invite | `creatorInvitationApi.create` | real ✓ |
| Open-group match preview | `campaignApi.getOpenGroupMatches` | real ✓ |
| Publish (wallet escrow lock) | `campaignApi.publish` | real ✓ |

11 endpoints. Every single field in the new mockup must trace to one of
the above. No invented metrics, no phantom rollups.

## Out of scope

- Backend changes (none — read-only audit)
- API shape changes (none — all 11 endpoints preserved)
- Field name changes (none — every request body identical)
- Migration / DB column changes (none)
- Validation rule changes (every existing validation message preserved)
- The /escrow + /sets + /influencers + /reviews sub-routes (Flow 6 shipped)
- The campaign detail hub (Flow 6 shipped)
