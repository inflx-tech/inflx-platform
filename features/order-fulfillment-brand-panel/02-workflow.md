# 02 — Workflow: Brand fulfillment panel

1. Brand → dashboard → Fulfillment → sees online orders (filter chips by status).
2. Expand an order → customer, ship-to address, items, 5-step stepper.
3. Confirmed → Mark Packed → Packed.
4. Packed → pick courier + enter AWB → Mark Shipped → Shipped (customer gets courier +
   AWB + track link).
5. Shipped → Mark Out for Delivery / Mark Delivered.
6. Delivered → terminal; commission releases after the return window.
7. Cancel available on any non-terminal order (notifies customer; commission withheld).

All actions hit the live Unit-1 backend; no new endpoint.
