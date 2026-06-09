# Workflow — Product Detail rebuild

## Flow
1. Tap a product (creator store / category / business page) → ProductDetail with
   { offer, brand, store, influencer, selectedProductId, product, tracking }.
2. Loads the product; renders hero+badge, title, rating (if any), brand line, creator note
   (if any), price+MRP+save.
3. Conditional Customize (add-on toggles) / Variants (size chips) — only if brand-defined.
   Toggling an add-on updates the running total in the sticky bar.
4. Description + More-from-brand rail.
5. Sticky CTA from availing_modes (Add to Cart / Buy / Book / Pay / Enquire) → dispatch to
   the existing purchase screen, carrying tracking + via_store_influencer_id + selected
   add-ons/size.

## Expected end state
Matches product-comprehensive.html; conditional blocks honest; buy flow intact.

## Verification
- Babel transform clean. Founder verifies visuals on device after OTA.
