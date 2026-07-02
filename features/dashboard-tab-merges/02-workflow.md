# Workflow Definition — Dashboard Tab Merges

## Actor
Logged-in brand.

## Workflow steps (user-observable)
1. Brand sees 8 top-level tabs (Contracts/Proposals/Offers no longer separate).
2. Campaigns list shows a "N contracts need your signature" strip → bulk-sign works; each row
   links into its campaign.
3. Inside a campaign, a Contracts tab lists that campaign's contracts per creator with status
   (draft/pending/live/completed) + counter-sign for pending ones.
4. Influencers tab → Discover (browse) and Proposals (inbox: accept/counter/reject) sub-tabs.
5. Listings tab → Products and Offers sub-tabs (offer library intact).
6. Visiting an old URL (/dashboard/contracts|proposals|offers) redirects to the new location.

## Success definition
- Every capability that existed in the 3 removed tabs still works from its new home; nav is 8 items.

## Failure / edge workflows
- Deep-links ?tab=proposals / ?tab=offers / ?tab=contracts land on the right sub-view.
- Handle-less pending contract: per-row counter-sign hidden, but the campaigns-list bulk strip
  (signs by id) still covers it — no lost action.
