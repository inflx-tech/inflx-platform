# Workflow prediction — Phase 3d (offer/discount rules)

Mockup: `04-preview/mockups/offer-discount-rule.html`.

Asserting for sign-off:
- The section builder gains a small "Offers" block with **"Has a live offer"** toggle +
  **"Minimum discount %"** input, under the existing rule fields.
- The live preview reflects them: count + sample show only products with a qualifying live
  store offer (discount badge on the thumbs is indicative).
- % = `brand_offers` published-to-store, live; pct offers use value, flat ₹ offers = ₹off÷price;
  store-wide offers count for all the brand's products.
- Both stack with category/tags/price + surface context; off = unchanged behavior.
- Backend: a correlated EXISTS over brand_offers added to libraryProducts only when set.
