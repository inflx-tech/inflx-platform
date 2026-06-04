# Impact Analysis — offer-engine-publish-ui

## Verdict (terse)
**Additive gap-fix — zero disturbance.** Adds brand controls + badges over the
already-live publish-to-store backend (D1). The only backend change is a
read-only count on the offers list.

## Mechanics
- **Frontend**: new row toggle + badges + a dialog distribution section; all
  drive the existing `PATCH /brands/me/offers/:id` (which already accepts
  `published_to_store`/dates). No existing offer behaviour changes.
- **Backend**: `listOffers` gains an `attached_count` subquery — read-only,
  additive, brand-scoped; no write, no schema change.
- **Store effect** unchanged: `resolveBusinessStore` already surfaces
  published+active offers (D1); this just lets the brand flip the flag + see status.

## Blast radius if it failed
Confined to the offers page + the offers-list response. The count subquery is
read-only; the toggle reuses a proven endpoint. No money/campaign path touched.

## Regression guard
brand-web `next build` GREEN; backend `brand-offer.test.js` +
`offer-store-publish.test.js` 15/15 GREEN (attach-count non-breaking). Existing
offer create/edit/activate/archive unchanged.

## Deploy posture
PRODUCTION-IMPACTING (Vercel + Render) but additive. No migration/OTA. Surfaced
for explicit go.
