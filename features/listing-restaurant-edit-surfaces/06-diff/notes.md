# Before/After — Wave 2b brand-web (dish capture + honest saves)

Mockups locked: `04-preview/mockups/01-add-dish-card.html`, `02-publish-result.html`.

## What shipped (matches the mockups)
- **Blank dish photos.** `RestaurantDishPicker.handleAddFromMaster` no longer copies the
  master `default_image_url`; a tapped dish starts with `image_url: null`. The added-dish
  card renders a dashed **"📷 ADD PHOTO"** placeholder instead of a stock image. (Search +
  custom add paths were already blank.)
- **Per-dish capture made explicit.** Each added-dish card now shows:
  - a dashed Add-photo thumbnail when no photo,
  - a nudge chip — "⚠ Add your photo & price" / "📷 Add your own photo" / "⚠ Set your price"
    — until both are set,
  - the price input highlighted (yellow) while price is empty/0. Master price still
    pre-fills as an overridable hint.
- **Honest publish result.** `publishDriver` now inspects the API envelope
  (`res.ok/res.success`) for the brand PATCH, each product POST, and variant POSTs — a
  server-rejected save is **counted as a failure with its real reason**, never as a
  success. The Done screen (`builtinStepComponents.done`) shows a **warning state + the
  real reasons** (e.g. "account under review") and the true saved count, instead of a fake
  "You're live · +N"; next-action cards + tips are hidden when nothing saved.

## Honest divergences from the mockup
- The mockup's "Save my progress" button is not added (the wizard already retains state in
  the session; a dedicated draft-save belongs with the build-while-pending backend work,
  which is a separate wave). The Done screen instead offers "Back to my listing — fix &
  try again."
- Section grouping shown in mockup 01 was already shipped backend-side (`2b7837f`); the
  card just renders `item.section` (no "Uncategorized").

## Not in this commit (separate, backend, no mockup)
- Build-while-pending gate removal + follower-visibility guard.
- Free location short-link expansion.
- One-time section backfill of existing dishes (run separately, founder-go'd).

## Verification
- `pnpm qa` GREEN (web/api/unit). Founder manual verify on the live brand-web after the
  Vercel deploy (add a dish → blank photo + nudge; trigger a failed save → honest message).
