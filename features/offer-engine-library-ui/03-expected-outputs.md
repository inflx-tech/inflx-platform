# Expected Outputs — offer-engine-library-ui (Sub-contract B)

## Files created
- `Packages/brand-web/app/dashboard/offers/page.js` — the offer library page
  ('use client'): list, status tabs, type filter, search, stats, empty state,
  create/edit modal (hosts `<OfferBuilder/>`), archive, toast. Scoped `.ofl` CSS,
  locked palette (ink #0A0A0A / yellow #FFC107).
- `Packages/brand-web/components/OfferBuilder.js` — reusable 5-type authoring
  form; self-contained `.ofb` scoped styles; exports the component plus
  `buildOfferConfig(draft)` and `emptyDraft()` (and `OFFER_TYPE_LABELS`) so the
  page and (later) the campaign wizard build identical payloads.

## Files changed
- `Packages/brand-web/lib/api.js` — add `brandApi.getOffers/createOffer/
  updateOffer/deleteOffer`.
- `Packages/brand-web/app/dashboard/layout.js` — add the **Offers** nav item to
  the `NAV` array (between Listings and Conversions).

## UI behaviour (verifiable against the locked mockups)
- `/dashboard/offers` renders the list per `04-preview/mockups/01-offers-list.html`
  (stats, tabs, filters, rows, empty state).
- The builder renders per `02-offer-builder.html` — 5 type cards switch the
  per-type fields; live preview updates.
- Create of each type succeeds against the live API; edit pre-fills + round-trips;
  archive soft-archives.

## Diff gate (06-diff/)
- `notes.md` with before (mockup HTML via Playwright) vs after (real
  `/dashboard/offers` via Playwright) side-by-side notes + a `*.capture.json`
  for the after-shot. Required before the prod deploy (UI-governed Rule 4).

## QA / proof of done
- brand-web `next lint` / `next build` clean for the new files.
- Manual/Playwright walk of the workflow steps (create 5 types, edit, archive).
- No backend change → backend `pnpm qa` lane unaffected (A already green).

## Release classification
**PRODUCTION-IMPACTING (Vercel) but additive** — new route + nav item +
component; no existing page/flow altered. Explicit founder go before `git push`
(Vercel auto-deploys brand-web). No OTA/backend.
