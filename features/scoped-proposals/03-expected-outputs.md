# Expected Outputs — Scoped proposals (Phase 8)

## GET /v1/influencers/me/discover-brands/:id/products?q=
```json
{ "success": true, "data": { "products": [
  { "id":"p1", "name":"Oversized Tee", "price":1299, "image_url":"…" },
  { "id":"p2", "name":"Sneakers", "price":2499, "image_url":"…" }
] } }
```
Gated: 403 if the brand does not `accepts_proposals`.

## POST /v1/influencers/me/proposals  (extended body)
```json
{ "brand_id":"br1", "pitch_title":"Street Style edit", "pitch_message":"…", "goal":"hybrid",
  "proposed_deliverables":[{"type":"reel","count":1}],
  "scope_level":"product", "scope_ref_json":{"product_ids":["p1","p2","p3","p4"]},
  "theme_key":"street_style", "proposed_product_ids":["p1","p2","p3","p4"] }
```
→ `{ success:true, data:{ proposal:{ id:"pr1", status:"sent", scope_level:"product", theme_key:"street_style", … } } }`
(Existing guardrails apply: cooldown / 5 active / 3 per day / 10 per week / 7-day TTL.)

## Brand accept (existing path) — now also seeds an experience draft
After accept, `creator_experiences` gains:
```json
{ "id":"exp1", "influencer_id":"inf1", "world_key":"fashion", "theme_key":"street_style",
  "template_key": "street_style_hero" | null, "source_proposal_id":"pr1", "status":"draft" }
```
with `experience_products` for the proposed products. If seeding is skipped (no match / failure) → the proposal still accepts and the mini-campaign is created exactly as today.

## Non-goals (must NOT appear)
- No change to accept/reject/counter/cooldown/rate-limit behavior.
- No brand-inbox rework (it renders the new scope/theme fields; no flow change).
- No mobile store-browse in 8a (that's 8b).
