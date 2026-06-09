# Feature Spec — Business Page (restaurant variant, schema-driven) — focused pass

> UI-governed (Mobile). Screen #6 (restaurant variant only, per founder). The Business
> Page is per-vertical + SCHEMA-DRIVEN: each vertical's page + custom CTA comes from its
> backend/public/schemas/<vertical>.json (availing_modes / card_config / actions). Other
> verticals' pages are built as each listing lands (fashion: pay-at-store/order-online;
> salon: book; etc.).

## Problem / goal
The restaurant Business Page (RestaurantDetailScreen) already has the hero, creator-picks
strip, sub-tabs, and schema-driven sticky CTA. Add the two mockup blocks it's missing,
matching business-comprehensive.html — WITHOUT touching the live checkout.

## Scope (in)
- **Action bar:** + Follow (visual toggle) · 🧭 Directions (opens maps).
- **"{Business} × Creators" row + trust line:** the brand's collaborating creators
  (store.influencers) as circles → InfluencerStore, with "✅ N creators trusted to collab
  with {brand}" — the platform differentiator.

## Scope (out)
- Checkout/cart/menu/CTA logic — preserved untouched (CTA already schema-driven).
- Salon/store + other-vertical Business Pages — built per vertical as listings land,
  from their schema JSONs (37 schemas exist in backend/public/schemas/).
- Brand "Follow" backend — visual-only for now (no brand-follow endpoint).

## Surfaces
- Mobile follower: screens/follower/RestaurantDetailScreen.js (additive blocks).

## Non-functional
- OTA-safe; NATIVE_RUNTIME '3'. Additive — zero change to the purchase path. Babel-validated.
