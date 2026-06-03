# Impact Analysis — offer-engine-library-ui (Sub-contract B)

## Verdict (terse)
**Additive UI — zero functional disturbance.** A brand-new route, one nav item,
one new component, and four thin API wrappers. No existing page, component, or
flow is modified; no backend change.

## Mechanics
- **New route** `app/dashboard/offers/page.js` — does not exist today; adding it
  cannot affect any current page. Inherits the layout-level brand auth guard.
- **Nav item** — one entry appended to the `NAV` array in `layout.js`. Pure
  addition; other items unchanged. No feature-gate, so it shows for all brands.
- **New component** `components/OfferBuilder.js` — self-contained scoped styles
  (`.ofb`), imported only by the new page. The campaign wizard is NOT touched in
  B (its inline builder keeps working); wiring `<OfferBuilder/>` into the wizard
  is Sub-contract C.
- **API wrappers** — additive functions on the exported `brandApi`; no existing
  method changed. They call the already-deployed, dormant `/brands/me/offers`.
- **Backend** — unchanged. The offers a brand creates here are real `brand_offers`
  rows, but with no distribution wiring (C/D) they surface nowhere follower-facing
  yet, so creating them changes no live follower/campaign behaviour.

## Blast radius if it failed
Contained to the new `/dashboard/offers` page. A bug there cannot affect
campaigns, products, wallet, or any existing dashboard surface (separate route +
separate component + separate API methods).

## Regression guard
brand-web `next build`/`lint` clean; existing pages untouched (diff is purely
new files + 2 additive edits). Backend `pnpm qa` lane unaffected (no backend
change). Before/after-diff captured per UI-governed gate.

## Deploy posture
PRODUCTION-IMPACTING (brand-web → Vercel) but additive. Surfaced for explicit go
before `git push`. No OTA, no backend redeploy.
