# Feature Spec — Influencer Groups (F-5)

> Real, server-persisted named influencer groups a brand manages in the Influencers tab and
> assigns to campaigns wholesale — replacing today's browser-localStorage-only groups.
> Approved in-session ("Yes — manage in Influencers tab").

## Problem / goal
Today the campaign wizard's "influencer groups" live only in localStorage — they vanish on
another device/browser, aren't visible to teammates, and exist only inside campaign creation.
Goal: make groups real (server-saved), manageable from the Influencers tab, and reusable —
pick a whole group to add all its influencers to a campaign at once.

## Scope
- In scope: brand-scoped groups CRUD (create/rename/delete + add/remove members); a "Groups"
  sub-tab in the Influencers tab to manage them; wizard swap from localStorage to server (pick a
  saved group → its members expand into the set, dedup preserved).
- Out of scope: group size caps; sharing groups across brands; group-level analytics.

## Surfaces touched
- backend: new influencerGroup controller + routes + migration 123. brand-web: influencers page
  (Groups sub-tab), campaigns/new wizard (localStorage→server), lib/api.js. No mobile.
- Roles: brand only (owns its groups).

## Data / contracts
- Migration 123: influencer_groups (id, brand_id FK, name, timestamps) + influencer_group_members
  (group_id FK, influencer_id FK, PK(group_id, influencer_id)) with ON DELETE CASCADE.
- Endpoints (all /brands/me/influencer-groups, requireRole('brand'), brand-ownership enforced):
  GET list (with member_count/members), POST create, PATCH rename, DELETE, POST :id/members,
  DELETE :id/members/:influencerId. Member ids validated against influencers.

## Non-functional
- Cross-brand isolation: a brand can only see/modify its OWN groups; member ids validated (no injection).
- Wizard behavior preserved (add-whole-group-to-set + dedup).
- A deleted influencer auto-drops from groups (cascade).
