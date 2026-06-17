# 05 — Impact: Cart (functional)

**Verdict: mobile-only functional build on top of the EXISTING real order/commission
backend. No backend, no migration. Fixes a latent bug (cart provider never mounted).**

## Mechanics
- `App.js` — wrap navigators in `CartProvider` (was defined but never mounted →
  `useCart()` was a no-op; this makes the cart actually work, including the existing
  restaurant cart).
- `services/CartContext.js` — `normalizeLine` (variant `line_key`, price/image from
  either shape); `addItem`/`forceReplaceWith` accept `extra={offer,creatorHandle}`;
  `updateQty`/`removeItem` match `line_key` OR `product_id` (restaurant back-compat);
  cart carries `offer` + `creatorHandle`.
- `screens/follower/CartScreen.js` — NEW; reads CartContext; qty/remove; summary;
  CHECKOUT → `OnlineOrder` with items + tracking + offer + store.
- `navigation/FollowerNavigator.js` — register `Cart` in SHARED_SCREENS.
- `screens/follower/ProductDetailScreen.js` — `useCart`; `online_order` CTA relabelled
  "Add to Cart"; `dispatchCta` intercepts `online_order` → `addToCart()` → Cart
  (cross-brand confirm). Other CTAs (Pay-at-Store/Book) unchanged.

## Blast radius
- Shared-component changes (CartContext, App provider) also re-activate the restaurant
  cart — verified back-compat (product_id key fallback; offer/creatorHandle optional).
- Deploy-class: production-impacting (mobile OTA). No backend/migration. Inert to
  `pnpm qa`. released=false until founder real-purchase verify.
- Risk: medium (touches a shared context + app root + PDP dispatch). Mitigated by
  back-compat key matching + optional new fields; metro bundle = syntax gate.
- Real-finance: NO new money path — reuses the audited `createOrder`/Razorpay/
  commission pipeline; cart only assembles items + carries tracking.
