# Before / after — locked CTA spec

**Before:** Charvitha Fashions (fashion_walkin) showed a hardcoded "Pay at
salon" trust chip and fallback CTAs because its schema defined NO actions;
salons had no Book Appointment button (schema missing its primary; "Book on
WhatsApp" stood in); car rentals had no Book Your Dates; two verbs coexisted
for walk-in pay; product pages said Buy Now / Reserve Car / Pay at Salon
against the founder's intent.

**After (per 04-preview/mockups/cta-bars.html, founder-locked Docs/CTA_SPEC.md):**
- Restaurant: ★Book a Table · Pay at Restaurant · Order Online; dish page
  ★Add to Cart · Pay at Restaurant.
- Fashion + Furniture: ★Pay at Store · Order Online on both pages.
- Salon: ★Book Appointment · Pay at Store on both pages.
- Car rental: ★Book Your Dates (→ pick a vehicle → CarBooking) · Pay at
  Garage; vehicle page ★Book These Dates (Enquire removed per founder).
- Trust chip wording is category-aware — 'Pay at store' on fashion,
  'Pay at salon' ONLY on salons, 'Pay at garage' on rentals.

No layout redesign — the existing BrandActionRow/product CTA stack simply
renders the founder's words from the schemas. Founder on-device walk of the
five business pages is the release gate.
