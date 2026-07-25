# Workflow Prediction — Collab detail

Mockup: `mockups/collab-lifecycle.html` §3 (state-driven detail).

## Predicted observable behaviour
1. A Collabs row opens CollabDetail; header shows brand · campaign · fee/goal + the
   6-node progress spine with the current stage lit.
2. The "next action" hero swaps with stage (To-sign → "Review & sign"; Active →
   "Upload …"; etc.), matching the mockup's two shown states.
3. Section rows appear/lock by stage (Deliverables locked until signed; Earnings from
   active on; Logistics only for physical delivery).
4. Hero + sections route to the existing sub-screens or perform inline accept/pass.

## Known mockup-vs-build deltas (expected, not defects)
- The **Tracking** state's dual social/platform panels shown in the mockup are NOT in
  this contract — Tracking detail is a separate contract; a tracking-stage collab here
  shows Deliverables + Earnings instead.
- Sub-screens opened from the sections are the CURRENT (pre-restyle) screens, not yet
  IG-clean — restyle is a later contract.
- Invite actions are inline (Accept/Pass) + Negotiate/Sign via existing screens; the
  open-group "applied" variant routes to the existing OfferDetail transitionally.
