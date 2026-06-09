# Feature Spec — Follower Product Detail rebuild (Creator-Vibe)

> UI-governed (Mobile). Screen #7. The product page a follower lands on from any pick —
> central to the commission test loop. Conditional, schema-driven blocks.

## Problem / goal
Bring ProductDetailScreen to product-comprehensive.html: it already had hero+badge,
title/brand, creator note, price+MRP+save, description, schema-driven CTAs, more-from-brand.
Add the mockup's remaining blocks WITHOUT touching the buy dispatch.

## Scope (in)
- Rating + reviews row (shown only if real rating data: product, else brand).
- Hero ♡ + share icons (visual).
- **Conditional Customize (food add-ons toggles, +₹) / Variants (size chips)** — rendered
  ONLY when the brand defined them (product.addons / variants_json.{addons,sizes,options});
  auto-hidden otherwise (honest, per mockup).
- **Running-total sticky bar** — price updates as add-ons toggle ("incl. N add-ons" / size).
- Preserve the schema-driven CTA dispatch (availing_modes) + price math + more-from-brand.

## Scope (out)
- Checkout/cart logic — preserved (CTA dispatch unchanged; add-ons/size passed through).
- Creator reels + creator discount-code blocks — deferred (per mockup).
- Backend add-on consumption — add-ons/size are passed to the order params; deeper
  order-side add-on pricing is a later step (most live products have no add-ons yet).

## Surfaces
- Mobile follower: screens/follower/ProductDetailScreen.js.

## Non-functional
- OTA-safe; NATIVE_RUNTIME '3'. Conditional blocks honest (hide when no data). Babel-validated.
