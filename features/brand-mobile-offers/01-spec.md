# Feature Spec — Brand mobile offer builders (A7)

> Step 2. Closes a real capability gap from the locked scope rule: offer building
> is neither campaign creation nor listing, so it must work on mobile.

## Problem / goal
The mobile Offer library could only create **discount** offers (pct / flat) — it told the
brand *"build volume/BOGO/bundle offers on the web dashboard"*. Under the founder's locked
scope (only campaign **creation** and **listing** are web-only), that is a gap. Add
**volume, BOGO and bundle** builders on mobile, including the product picker they need.

## Scope
**In scope**
- `utils/offerBuilders.js` — pure `buildDiscount / buildVolume / buildBogo / buildBundle`
  producing exactly the `offer_config_json` shapes the backend
  `services/offerConfig.validator.js` requires (verified by reading it), with client-side
  validation so we never post a rejected shape. Unit-tested (10 specs).
- `components/brand/ProductPickerSheet.js` — single/multi product picker over the existing
  `brandApi.listProducts()`; the missing piece that forced BOGO/bundle onto web.
- `BrandOffersLibraryScreen` — offer-type selector (Discount · Volume · BOGO · Bundle) with
  per-type forms: volume tiers (spend ₹ or quantity → % off, add-tier), BOGO (product +
  buy/free qty), bundle (2+ products + bundle price). Copy updated (no more "on the web
  dashboard").

**Explicitly out of scope**
- **free_gift** builder (needs main+gift product pairs — lower usage; still web).
- Editing an existing offer's mechanic (backend makes `offer_type` immutable by design —
  create a new offer instead).
- Offer scope beyond `store` for discount/volume (category/product scoping stays web).

## Surfaces touched
- App: **mobile (brand) only** — OTA. No web, no backend.

## Data / contracts
- No new endpoint: `brandApi.createOffer / updateOffer / listProducts` all already exist.
  Config shapes mirror the backend validator.

## Non-functional
- Client validation mirrors server validation (positive thresholds, pct ≤ 100, bundle needs
  ≥2 products) so failures surface before the request; server errors still surfaced honestly.

## Design reference
Existing builder sheet pattern in the same screen; `04-preview/mockups/reference.html`.
