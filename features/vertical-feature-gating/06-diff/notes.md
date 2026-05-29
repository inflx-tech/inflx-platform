# Before / after — Vertical feature-gating

## What was implemented
- `backend/src/services/schema.service.js` (NEW): canonical `loadSchema` +
  `clearSchemaCache`, extracted verbatim from brand.controller.
- `backend/src/middleware/auth.js`: new `requireBrandFeature(featureKey)` —
  resolves `brands.category` by `user_id`, loads the schema, passes only
  when `features[featureKey]===true`, else 403.
- `backend/src/routes/meals.routes.js`: 11 brand-side routes now run
  `requireRole('brand') + requireBrandFeature('meals')`.
- `backend/src/routes/brand.routes.js`: 3 bookings routes now run
  `requireBrandFeature('booking')`.
- `backend/public/schemas/restaurant.json`: `features.meals: true`.
- `backend/src/controllers/brand.controller.js`: imports loadSchema/
  clearSchemaCache from the service; dead `fs`/`path` imports removed.
- `Packages/brand-web/app/dashboard/layout.js`: `Meals`/`Bookings` tagged
  with a `feature` key; nav filtered by `/brands/me/schema` features;
  gated items hidden until schema resolves.

## What matches the mockup
- Restaurant: Meals + Bookings present. Car-rental: Bookings only, no Meals.
- Fashion (booking=false): neither. Universal items unchanged everywhere.

## What diverged
- Live nav keeps the production Tailwind chrome + active-route highlight;
  mockup only approximates spacing/colour. Item set + gating match exactly.

## What to check (verification)
- `pnpm qa` green (regression net) — see lock.release.qa_run.
- Backend module-load smoke passes (all touched modules require() clean).
- Manual matrix (Flow A + B in 02-workflow / 03-expected-outputs):
  restaurant 200 on /meals/config; car_rental 403 on /meals/config, 200 on
  /me/bookings; fashion 403 on both.
