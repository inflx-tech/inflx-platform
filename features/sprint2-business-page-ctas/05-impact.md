# Impact — locked CTA spec

**Verdict: data + wording fix on existing machinery — schemas now say what the founder decided; the app stops inventing verbs.**

- Backend: schema JSON files only (ship with the Render deploy; loadSchema
  serves them) + the idempotent apply script. No code, no migration.
- Mobile: two screens touched — dispatch verb aliases (walkin_pay kept for
  OTA-lag phones), category-aware trust chip, product CTA order/labels.
  BrandActionRow/PreBook/PayAtStore/OrderCart/CarBooking all unchanged.
- Behaviour deltas: enquiry no longer on restaurant/furniture/car CTA bars
  (founder decision); salon/car gain their primary Book buttons; fashion
  gains Pay at Store primary on product pages.
- Risk: schemas feed brand-web listing wizards too (listing_config sections
  untouched — only brand_config.actions + availing_modes changed; offer
  validateAvailingModes vocabulary uses the same four canonical modes).
