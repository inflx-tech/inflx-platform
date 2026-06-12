# Workflow prediction — Sprint 3 cart

When the founder taps **Order Online** from a fashion/furniture product:

1. **Product page** shows a **Size** chip row and a **Colour** chip row
   (both brand-defined; auto-hidden when the product has none). Picking
   both resolves a specific priced variant; the footer price updates to
   the variant price + selected add-ons.
2. Tapping **Order Online** opens the **Cart** with that product as a
   line showing its **size · colour · add-ons** and the variant price.
3. The cart's **+ Add** address flow returns to the cart with the new
   address **already selected** and **Place Order enabled**.
4. **Place Order** succeeds — a toast confirms, and the order appears in
   the **Orders** tab (creator-mediated: with the deal discount; organic:
   full price, no discount).

Predicted failure if unfixed: Place Order stays greyed (no selectable
address) or errors "Order Failed" (422) — exactly W9(e).
