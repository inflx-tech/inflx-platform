# offer-engine-publish-ui — publish-to-store toggle + distribution badges (brand-web)

> **Gap-fix on the Offer Engine**, found during functional testing: the
> publish-to-store *backend* shipped (D1) but the brand had **no UI control** to
> publish, and Screen 01's **distribution badges** ("In store" / "N influencers")
> were never built. This closes both — making the Store channel usable end-to-end
> from the brand dashboard. UI-governed (brand-web) + a tiny additive backend read.

## Problem / goal
On `/dashboard/offers`, offers could only be Edited/Archived — no way to flip an
offer "into the store", and no indication of where each offer is distributed.
The offer-update API already accepts `published_to_store` (+ window dates), and
`resolveBusinessStore` already surfaces published offers; only the brand-facing
controls + badges were missing.

## Scope
- **In scope:**
  - **Publish-to-store toggle** — one-click "◧ Publish to store / In store ✓" on
    each **active** offer row, plus a "Publish to store" section (toggle + optional
    start/end dates) in the create/edit dialog.
  - **Distribution badges** on each offer row: "◧ In store" (when
    `published_to_store`) and "★ N influencers" (attach count).
  - Backend: `GET /brands/me/offers` returns `attached_count` per offer (count of
    `campaign_influencers` referencing it) for the badge.
  - Copy fix: drop the stale "(soon)" from the page subtitle.
- **Out of scope:** mobile per-product STORE DEAL ribbons (Screen 04 — mobile,
  separate); open-group group offers.

## Surfaces touched
- **App(s):** brand-web (`app/dashboard/offers/page.js`) + backend
  (`brandOffer.controller.listOffers` — additive read-only `attached_count`).
- **Roles:** brand.

## Data / contracts
- No migration, no new endpoints. `published_to_store` / `store_starts_at` /
  `store_ends_at` already exist (084) and are accepted by `PATCH /brands/me/offers/:id`
  (D1). New: `attached_count` field on the list response (read-only count).
- Publish only takes effect for **active** offers (store surfacing requires
  `status='active'`); the UI gates the row toggle to active offers and notes it
  in the dialog for new drafts.

## Non-functional
- **Auth/role gates:** existing brand-scoped offer CRUD.
- **Failure modes:** publishing a draft has no store effect until active (UI
  communicates this); unpublish removes it from the store feed.
- **Deploy posture:** PRODUCTION-IMPACTING (brand-web → Vercel + a 1-line additive
  backend read → Render) but additive — no existing behaviour changes. UI-governed
  → mockup-lock + before/after-diff gates apply. No migration/OTA.
