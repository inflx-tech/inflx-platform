# Before / After — Product push-to-store (Phase 2a)

> UI-governed diff notes. Playwright before/after capture runs in the dev env;
> recorded in plain English meanwhile.

## Brand inventory — "Show in store" toggle (CHANGED)
- **Before:** a brand's products had no store-visibility control; the brand store showed **all** active products.
- **After:** every product has a **"Show in store"** switch:
  - **Drill-down flow** (fashion/furniture — `DefaultFleetRow` in `ListingTemplateLayout`): inline switch + an "In store"/"Hidden" badge; row dims when off. This is the surface the founder uses.
  - **Standard flow** (`ProductFormModal` in `products/page.js`): a "Show in store" toggle beside the Active toggle.
  - Default **ON** (parity). Toggling calls `PATCH /brands/me/products/:id {pushed_to_store}`.

## Follower — brand store (CHANGED, behaviour-preserving)
- **Before:** `resolveBusinessStore()` returned all `is_active` products.
- **After:** returns `is_active AND pushed_to_store`. Default true → **identical to today on deploy**; a brand hides a product by un-pushing it.

## Verification
- Migration 101 applies clean in-chain (DB lane).
- brand-web production build exit 0.
- Backend: brand store filters pushed; create defaults true; update accepts the flag; list returns it.

## Scope note
- Typed drill-down FleetRows (restaurant/salon/car) receive `onTogglePush` but render the switch via `DefaultFleetRow` only this slice — a quick follow-up adds the inline switch to those rows. Founder (fashion) is covered.
- Platform pages + creator store gating = 2c / 2b.
