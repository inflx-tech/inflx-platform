# Workflow — contract join fix

1. Brand opens a campaign → Contracts tab.
2. Each creator row resolves its pending contract by campaign_influencer_id — exact, even if
   the Instagram handle is missing, renamed or shared.
3. Counter-signing locks the correct amount against the correct creator.

## Success
- Pending contracts map 1:1 to the right creator with no handle dependency; sign works as before.

## Failure/edge
- Older cached payload without the id → falls back to the previous handle match (no regression).
