# Expected outputs

- New brand number on mobile: OTP → registration form (NOT Waiting).
- Submit with all fields → 201, brands row exists, app shows Waiting; admin
  queue lists the business.
- Search-mode registration → brands.lat/lng/locality/formatted_address set.
- Manual-mode registration → row identical to a web manual registration.
- Existing approved brand number → straight to brand home (unchanged).
- Existing pending brand (already registered) → Waiting (unchanged).
- Industry picker shows the W1 regrouped hierarchy (Education, Consultation
  Services, Events as separate industries; no coaching under Health, no
  interior/coworking under Home Services).
