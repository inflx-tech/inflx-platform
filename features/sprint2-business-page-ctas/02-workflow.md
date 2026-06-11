# Workflow — locked CTAs live on every business page

1. Follower opens any fashion/furniture/salon/car business page →
   BrandStoreScreen renders BrandActionRow from template.brand_config.actions:
   the founder-locked set with ONE primary big button (Pay at Store / Book
   Appointment / Book Your Dates) + secondaries + contact row.
2. Trust chip reads correctly per category ('Pay at store' on Charvitha
   Fashions — never 'Pay at salon' again).
3. Primary tap routes: pay_at_store → PayAtStore; book_slot → PreBook;
   book_daterange → fleet tab → vehicle card → CarBooking; online_order →
   OrderCart; tracking flows through unchanged.
4. Product page CTA stack follows the locked product spec: restaurant dish
   ★Add to Cart · Pay at Restaurant; fashion/furniture item ★Pay at Store ·
   Order Online; salon service ★Book Appointment · Pay at Store; car vehicle
   ★Book These Dates.
5. Restaurant business page unchanged (already conformed).

Expected end state: every CTA the founder locked in Docs/CTA_SPEC.md renders
with his exact wording and order, sourced from the schema — zero hardcoded
business verbs left on the business page.
