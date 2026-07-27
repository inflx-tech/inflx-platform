# Workflow — A5 step 1 Production stage
## Actor
Brand on an active campaign with contracted creators.
## Steps
1. Open a campaign → a **Production** tab lists active creators, each showing a logistics
   chip (Physical — with address — vs Remote).
2. Tap **Manage logistics** on a creator → the influencers page opens (existing
   ContractModal → ProductionPanel schedules the visit / adds shipment tracking / flips
   to remote).
3. Remote creators show "no logistics needed".
## Success
- Every active creator's logistics status is visible in one hub tab; managing routes to
  the working panel; no existing behavior changes.
## Failure/edge
- No active creators → empty state. physical_delivery missing in payload → chip omitted,
  row + manage link still shown.
