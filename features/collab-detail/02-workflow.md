# Workflow Definition — Collab detail

> Step 3. Each step becomes an assertion.

## Actor
Logged-in influencer, approved.

## Preconditions
Engagements across stages (as in collabs-list), each openable by
`campaign_influencer_id`.

## Workflow steps (user-observable)
1. From Collabs, tap any row → **CollabDetail** opens (one screen for every stage).
2. Header shows brand · campaign · fee/goal + a **progress spine** with the current
   stage lit.
3. A **next-action hero** shows the one thing to do now, matching the stage:
   - invited → Accept / Negotiate / Pass buttons.
   - accepted / pending_influencer → "Review & sign".
   - active → the pending deliverable action.
   - pending_brand → "Signed · waiting for brand" (informational, no button).
   - completed → "View earnings".
4. Tapping the hero performs the action:
   - Accept → confirm → API → screen reflects the new stage (now "To sign").
   - Pass → reason confirm → API → collab moves to Archive; user returns to list.
   - Negotiate → opens `NegotiationScreen` for this collab.
   - Review & sign → opens `ContractScreen`.
   - Upload → opens the deliverable flow.
   - View earnings → opens `CommissionDetail`.
5. **Section cards** below the hero open the matching existing sub-screen (Contract,
   Deliverables, Earnings, Products, and Logistics when `physical_delivery`).
6. A notification/Home deep-link that used to open OfferDetail/CampaignDetail now
   opens **CollabDetail** for that `campaign_influencer_id`.

## Success definition
Successful only if:
- One `CollabDetailScreen` renders correctly for an engagement in **each** stage
  (invited, negotiating, to-sign, active, completed), showing the correct spine
  position, the correct hero action, and the correct set of section cards; every
  hero/section tap lands on the right destination or performs the right API action;
  and no OfferDetail/CampaignDetail is reachable from a Collabs row anymore (they
  remain only as transitional deep-link targets).

## Failure / edge workflows
- Invalid / not-owned `campaign_influencer_id` → NOT_FOUND error state + back, no crash.
- Accept/Pass API failure → error message shown, stage unchanged (no optimistic
  corruption).
- A stage with no user action (pending_brand) → informational hero, never a dead CTA.
- Open-group `applied` engagement → routes its action to the existing OfferDetail
  (documented transitional carve-out) rather than a broken inline path.
