# Before / After — contract↔influencer join

**Before:** the hub built `pendingByHandle` from the pending-contracts payload and looked up each
creator by a coalesced, lower-cased, @-stripped **handle string**. Because
`GET /contracts/brand/pending` never selected `campaign_influencer_id` — despite already JOINing
`campaign_influencers` — the client had no real key available. A missing, renamed or duplicated
handle could silently attach the wrong contract, or none, on the surface that **locks brand funds**.

**After:** the endpoint returns `campaign_influencer_id` (one added SELECT column, additive), and
the hub matches on it, keeping the handle map only as a fallback for payloads that predate the
change. Exact, key-based matching on a money-adjacent flow.

## Changed
- `backend/src/controllers/contract.controller.js` — listBrandPending SELECT.
- `Packages/brand-web/app/dashboard/campaigns/[id]/page.js` — pendingByCiId + fallback.

## Verification
- **pnpm qa GREEN — 79/79 passed, gate 0** (no regression from the backend change).
- brand-web `next build` compiled clean.

## Known delta
- Invisible in the happy path; it only changes behaviour where the handle join was already wrong.
