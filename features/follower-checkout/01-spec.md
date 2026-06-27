# 01 — Spec: follower-checkout (shopping cart/checkout)

Locked with the founder 2026-06-27 (mockup + correction). The shopping cart/checkout
(`CartScreen`) shows the follower **one flat list** (NO brand grouping); the backend
**segregates silently per brand** and sends each brand only their items + the customer's
delivery info.

## Locked structure (follower-facing)
1. **Items** — one flat list (already exists), with qty + variant labels.
2. **Bill details** — Item total · Item savings (MRP) · Offer discount · Delivery (Free) ·
   To pay (already exists).
3. **You might also like** — same-category cross-sell, excluding cart items.
4. **Address** — saved address + Change.
5. **Payment** — PhonePe UPI default; tap → other Razorpay methods.
6. **Place Order → payment.**

## Slices
- **Slice A (THIS contract) — recommendations.** New `GET /follower/cart-recommendations`
  (live products in the same `section`s as the cart items, ranked by markdown then newest,
  excluding cart ids) + a "You might also like" rail in `CartScreen`.
- **Slice B (next) — checkout bar + per-brand split.** Address + payment-mode bar in the
  cart; Place Order splits the cart by `line.brand_id` → one order per brand (customer info
  attached); payment-mode selector (wired to the current mock until real Razorpay).

## Out of scope (Slice A)
- The address/payment bar consolidation + the multi-brand order split (Slice B).
- Real Razorpay multi-method charge (money task).

## Acceptance (Slice A)
- The cart shows a relevant "You might also like" rail; tap → the product page.
- Backend endpoint returns same-category products excluding the cart items.
- pnpm qa green; mobile compiles; CartScreen test green.
