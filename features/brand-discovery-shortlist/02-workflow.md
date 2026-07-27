# Workflow — discovery shortlist + working invite
## Actor
Approved brand.
## Steps
1. In results, an onboarded creator's card shows **Shortlist** → pick an existing group or
   create one → creator is added (confirmation toast).
2. Open a creator's full profile → **Invite to Campaign** → choose campaign → choose set →
   Invite → the creator is really invited (appears in their offer inbox).
3. A scraped/unclaimed creator still shows Invite-to-join (unchanged).
## Success
- Shortlisting from a card actually persists to a brand influencer group; the profile
  invite actually creates the invitation via the campaign/set invite endpoint.
## Failure/edge
- No campaigns/sets yet → the modal says so and links to the campaign wizard (honest, not a
  dead end).
- Invite API failure → the real error message is shown; nothing is faked.
