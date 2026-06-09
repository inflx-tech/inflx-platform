# Before / After — Product Detail rebuild

Mockup: 04-preview/mockups/product-comprehensive.html.
Screen: ProductDetailScreen.js.

## Before
- Hero+badge, title, brand, creator note, price+MRP+save, description, schema-driven CTAs,
  more-from-brand. No rating row; no Customize/Variants block; static sticky price.

## After (additive)
- Rating + reviews row (if real data). Hero ♡/share. Conditional Customize (add-on toggles,
  +₹) / Variants (size chips) — hidden when brand defined none. Running-total sticky bar
  ("incl. N add-ons" / size). CTA dispatch + price math + more-from-brand unchanged.

## Verification
- Babel transform clean. Founder = on-device acceptance gate; Maestro waived via GOVERNANCE_OVERRIDE.
