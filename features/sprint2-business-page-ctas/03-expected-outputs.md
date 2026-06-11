# Expected outputs

- Journey S6.2: business store template carries ≥2 transactional actions,
  EXACTLY one primary, no legacy walkin_pay verb → PASS with
  primary=Pay at Store, ctas=[Pay at Store · Order Online] for the fashion brand.
- All 6 schemas: brand_config.actions present, 1 primary, canonical modes
  (verified by apply-cta-spec.js output + node require checks).
- Trust chip on a fashion store reads 'Pay at store'; salon keeps
  'Pay at salon'; car reads 'Pay at garage'.
- ProductDetail on a salon service shows ★Book Appointment then Pay at
  Store; on a car shows only Book These Dates; on a dish shows ★Add to Cart
  then Pay at Restaurant.
- Existing flows regress green: journey 30/30, pnpm qa 79/79.
