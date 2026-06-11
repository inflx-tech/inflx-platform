# Workflow prediction — offer tap-through

Mockup tap-flow.html shows the three tap channels and their states. No visual
redesign in this contract — the existing locked Offers/Product screens simply
START WORKING: tap any offer card → product page with the offer mechanic
block → working CTA → payment. Predicted calls per channel: store/showcase →
GET /follower/store-offer/:id then POST /follower/store-offer/pay; assignment
→ GET /store/:handle/products?ci_id then POST /follower/pay-at-store (long-
form 4-ID tracking) / orders / prebook.
