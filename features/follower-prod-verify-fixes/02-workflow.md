# 02 — Workflow: prod-verify fixes

1. Tap a product from any shelf/Results → PDP fetches `GET /follower/products/:id` →
   shows image carousel (swipe through cover/colour images) + price + Product Details
   (facets + section + returns) + description + size/colour selectors + single
   **Add to Cart** CTA (no Pay-at-Store for fashion/furniture).
2. Add to Cart → Cart → Checkout → Shipping: + Add address → enter → Save. The API
   client now silently refreshes the access token on 401 (refresh token persisted at
   login) → address saves; no "session expired".
