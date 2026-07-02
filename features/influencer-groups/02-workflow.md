# Workflow Definition — Influencer Groups (F-5)

## Actor
Logged-in brand.

## Preconditions
Migration 123 applied.

## Workflow steps (user-observable)
1. Brand → Influencers → Groups sub-tab → sees their saved groups (name + member count).
2. Brand creates a group (name + pick influencers) → it's saved on the server.
3. Brand opens a group → rename, add members, remove a member, or delete the group.
4. The same groups appear on any device / for teammates (server-backed, not browser-local).
5. Brand creates a campaign → in the influencer step, picks a saved group → all its influencers
   are added to the set at once (dedup against already-added).

## Success definition
- Groups persist server-side, are managed from the Influencers tab, and a whole group can be
  assigned to a campaign in one action.

## Failure / edge workflows
- A brand cannot see or modify another brand's group (404/forbidden).
- Empty group renders an empty state; deleting a group cascades its members.
- A member influencer later deleted → auto-removed from the group.
