# Workflow Definition — Campaign Command Center

## Actor
Logged-in brand (approved), viewing one of their own campaigns.

## Preconditions
A campaign with ≥1 set and ≥1 creator; at least one creator with a submitted deliverable
(for the content-review path).

## Workflow steps (user-observable)
1. Brand opens a campaign → sees the Command Center: header (status/dates/budget), a tab
   bar (Hierarchy / Needs action / Analytics), and the hierarchy tree of sets→creators
   with attention flags. → tree renders from GET /campaigns/:id.
2. Brand clicks a creator → right pane shows that creator's stage tracker, a context
   action card, deliverables, offer/products, window/payout, and this-creator performance.
3. Creator with a submitted post → action card shows the content with Approve /
   Request revision / View full → Approve calls the existing deliverable review endpoint →
   stage advances. (This is the re-surfaced review UI.)
4. Brand opens "Needs action" → one inbox lists every item awaiting them (content,
   contracts, negotiations, date requests); clicking jumps to that creator.
5. Brand opens "Analytics" → sees Campaign total, then per-Set cards (set-average ER +
   set totals), expandable to per-creator rows. → data from /engagement + /conversions.
6. (New-build path) Creator requests a date change → brand sees Approve/Reject in the
   action card → Approve shifts the window for that creator only.

## Success definition
- The brand can, without leaving the screen: see every creator's stage, approve submitted
  content, sign a contract, act on a negotiation, and read per-creator / per-set / campaign
  performance — all from real data.

## Failure / edge workflows
- Creator not live → performance shows "no data yet"; no phantom numbers.
- No items awaiting the brand → "Needs action" shows an empty, all-clear state.
- Reach/impressions are never shown (not captured).
