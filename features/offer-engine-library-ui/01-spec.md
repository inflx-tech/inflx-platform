# offer-engine-library-ui — Sub-contract B: offer library UI (brand-web)

> **Sub-contract B of 4** in the Offer Engine feature. The brand-facing
> authoring surface for the reusable offer library shipped by Sub-contract A.
> UI-governed (brand-web). Builds on the live `/brands/me/offers` CRUD API.
> Distribution UI (publish-to-store toggle, per-influencer campaign attach,
> distribution badges) is intentionally OUT — those are Sub-contracts C/D.

## Problem / goal
Sub-contract A shipped the `brand_offers` table + CRUD API, but there is no UI —
a brand cannot yet see or author its offer library. B adds the `/dashboard/offers`
page so a brand can **design, edit, and manage reusable offers** against its
product/service catalogue, independent of any campaign. The existing in-campaign
discount builder is untouched (coexist).

## Scope
- **In scope:**
  - New nav item **Offers** in the brand dashboard topbar (between Listings and
    Conversions), no feature-gate (all brands).
  - New page `Packages/brand-web/app/dashboard/offers/page.js`:
    list of the brand's offers, status tabs (All/Active/Drafts/Archived), type
    filter, search, summary stats, empty state; create / edit / archive.
  - New reusable component `Packages/brand-web/components/OfferBuilder.js` — the
    5-type authoring form (Discount / Volume / BOGO / Bundle / Free gift), scope
    (store/category/products), availing modes, live preview. Self-contained
    styles (own scoped class) so Sub-contract C can drop it into the campaign
    wizard without CSS coupling. Exports `buildOfferConfig(draft)` +
    `emptyDraft()` so callers build the API payload identically.
  - `Packages/brand-web/lib/api.js`: add `brandApi.getOffers/createOffer/
    updateOffer/deleteOffer` wrappers over the existing `api.*` helpers.
  - The emitted `offer_config_json` matches the shapes the A validator accepts
    (discount/volume/bogo/bundle/free_gift), so creates/updates succeed.
- **Explicitly out of scope (later sub-contracts):**
  - Publish-to-store toggle + store window dates (writes `published_to_store`) →
    **Sub-contract D** (the column exists but is consumed only there).
  - Per-influencer campaign attach + the library picker inside the campaign
    wizard, and replacing the wizard's inline builder with `<OfferBuilder/>` →
    **Sub-contract C**.
  - Distribution badges on the list ("In store" / "N influencers") — they depend
    on C/D data; B shows status only.

## Surfaces touched
- **App(s):** brand-web only (Next.js, Vercel). No backend change (CRUD already
  live). No mobile.
- **Roles involved:** brand (authenticated; layout-level guard already enforces
  role==='brand').

## Data / contracts
- **No new tables or endpoints.** Consumes the Sub-contract A API:
  `GET/POST/PATCH/DELETE /brands/me/offers`.
- Product catalogue read via the existing `brandApi.getProducts()` (for the
  scope=products picker and BOGO/bundle/free-gift product selection); sections
  via the existing brand schema/sections the wizard already uses.
- `offer_type` values sent: `discount|volume|bogo|bundle|free_gift`. UI labels
  map: "Discount"→discount, "Volume discount"→volume, "BOGO"→bogo,
  "Bundle"→bundle, "Free gift"→free_gift.

## Non-functional
- **Auth/role gates:** inherited from `app/dashboard/layout.js` (redirects
  non-brand / unauthenticated). API calls carry the bearer token via `lib/api.js`.
- **Failure modes handled:**
  - API validation error (422) → inline field error + toast; modal stays open,
    no navigation.
  - Empty catalogue → product-scoped/BOGO/bundle pickers show a "add products
    first" hint (mirrors the wizard).
  - Network/load error → error state, retry.
- **Deploy posture:** PRODUCTION-IMPACTING (brand-web → Vercel) but **additive** —
  a brand-new route + nav item + component; no existing page or flow changes.
  UI-governed → mockup-lock + before/after-diff gates apply.
