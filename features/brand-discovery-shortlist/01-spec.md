# Feature Spec — Discovery: shortlist + working invite (steps 3+4, completes discovery)

> Step 2. Final discovery slice. Adds save-to-shortlist from a result card and
> replaces the dead invite placeholder on the profile with a REAL invite.

## Problem / goal
Two gaps close here:
1. **No shortlist from browsing** — Groups exist as a sub-tab, but a result card has no
   "save" action, so shortlisting is disconnected from searching.
2. **The profile's "Invite to Campaign" is a dead placeholder** — the modal says "go to your
   campaign wizard and use handpick mode" and just links to /dashboard/campaigns. No invite
   happens from the creator you're looking at.

## Scope
**In scope**
- **Shortlist from a card**: a Shortlist action on `CreatorRow` → picks/creates a brand
  influencer group via the existing `influencerGroupApi` (`list` / `create` /
  `addMembers`). Only for onboarded creators (a group member needs a real influencer id);
  scraped/unclaimed creators keep Invite-to-join.
- **Working invite from the profile**: replace the placeholder modal with a real one —
  choose campaign → choose set → confirm → `campaignApi.inviteInfluencer(campaignId, setId,
  { influencer_id })` (the verified endpoint; influencer_id is the only required field).
  Success → toast + close; failure → the API error message.

**Explicitly out of scope**
- Side-by-side **compare** view (needs a comparison surface + more per-creator data to be
  worth it — flagged as the remaining discovery nice-to-have).
- Content thumbnails, audience demographics, city/niche pick-lists (backend batch /
  taxonomy).

## Surfaces touched
- App: brand-web only (influencers/page.js card action; influencers/[id]/page.js invite
  modal). Roles: brand.

## Data / contracts
- Endpoints: all existing — `influencerGroupApi.list/create/addMembers`,
  `campaignApi.list`, `campaignApi.get` (for sets), `campaignApi.inviteInfluencer`.
  No new endpoint, no backend change.

## Non-functional
- Invite is a real state change → confirm step + honest error surfacing; no optimistic fake
  success. Shortlist only offered where it can actually work (onboarded creators).

## Design reference
`04-preview/mockups/discovery-card.html` (card with Shortlist + Invite).
