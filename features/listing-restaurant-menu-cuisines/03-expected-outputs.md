# Expected Outputs — Add-menu cuisines + location mock-off

## Location
- `GEOCODING_MOCK` is opt-in (default OFF). With no env var (prod), a pasted Google Maps
  SHORT link resolves to the **real coordinates** of that place (not the fixed Vijayawada
  mock). The "MOCK MODE" badge no longer appears in prod.
- A short link that can't be expanded → honest "open it in Maps and copy the full URL".

## Add-menu cuisines
- A registered restaurant re-opening Add-Menu sees its **saved cuisines** and their dishes
  (no "No dishes available… (none)").
- The empty state (no cuisines yet) shows a **cuisine picker**, not "go back to step 1".
- The cuisine nav shows an inline **"➕ Add cuisine"**; adding one immediately shows that
  cuisine's dishes and persists to the brand profile (survives reload).
- Cuisine → Section → Dish works end-to-end without opening "Edit business setup".

## Gate
- `pnpm qa` GREEN; C1 GREEN; mockup_locked + non-empty 06-diff/notes.md.
- Render (backend) + Vercel (brand-web) deploys classified production-impacting, founder go.
