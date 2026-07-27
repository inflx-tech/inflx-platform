# Feature Spec — Brand influencer discovery: scannable card (step 1)

> Step 2. First discovery slice. Replaces the cramped 1-line result row with an
> IG-clean scannable creator card, over existing data. Content thumbnails +
> audience demographics = backend batch.

## Problem / goal
The directory shows each creator as a cramped 64px single-line row (5 columns, 8.5px
labels, emoji) — unscannable. Replace `CreatorRow` with an IG-clean **card**: avatar,
name + tier, the three decision numbers (Followers · Engagement rate · Est. rate) as
tiles, a clean meta line, and the Add/Invite action — preserving all current behavior.

## Scope
**In scope**
- Rewrite the `CreatorRow` component in influencers/page.js as an IG-clean card (Tailwind,
  off the `.inf` scoped palette). Preserve: row→profile navigation, Add (onboarded) vs
  Invite (scraped) action, verify tick, tier pill, scraped/stale tags, city/niche/collabs
  meta. Show Followers / view-based ER / Est. rate (min–max) as three stat tiles; drop the
  emoji (📍🎨⭐✉).

**Explicitly out of scope (later steps / backend batch)**
- Content thumbnails (needs creator recent-posts data), real audience demographics,
  filter-bar restyle (sliders / pick-from-list), shortlist/compare, working invite-from-
  profile, one-design-system merge of the .inf/.prp/.groups idioms. The mockup shows a
  thumbnail strip as the target; this slice ships the card without it.

## Surfaces touched
- App: brand-web only (the CreatorRow render). Roles: brand.

## Data / contracts
- None new. Reuses the existing result fields (followers_count, view_based_er,
  estimated_min/max_rate, tier, ig_handle, city, niche, etc.).

## Non-functional
- Behavior-preserving restyle of one component; filters/search/data-fetch untouched.

## Design reference
`04-preview/mockups/discovery-card.html`.
