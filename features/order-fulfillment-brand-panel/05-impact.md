# 05 — Impact: Brand fulfillment panel (Unit 2)

**Verdict: additive brand-web page. No backend change (uses Unit-1 endpoints). No
migration.**

## Mechanics
- NEW `app/dashboard/fulfillment/page.js` — client component, scoped CSS (dashboard
  black/yellow). Uses `orderApi.list` + `orderApi.updateStatus` (already in lib/api.js).
- `app/dashboard/layout.js` — one nav entry (📦 Fulfillment) between Offers and Conversions.

## Blast radius
- New route + one nav link. No change to existing pages/endpoints/schema.
- Deploy-class: production-impacting (Vercel brand-web). No migration, no mobile, no
  backend. released=false until founder verify.
- Risk: low — additive page; actions are guarded (ship needs courier+AWB; cancel
  confirms). The backend status transition has no strict state machine, so the UI only
  offers valid next-steps (defense in the UI).
