# meals-restaurant-web — impact

## Blast radius
- New brand-web route `app/dashboard/meals/page.js`; one new nav item;
  one `mealsApi` block added to `lib/api.js` (additive export).
- Backend: additive read/manage/dashboard endpoints in the existing
  `/meals` namespace — no existing route/query touched.
- No change to any non-Meals page or table.

## Regression risk
- **Low.** The nav item + new route are additive; the API client gets a
  new export only. `pnpm qa` (web lane) green confirms existing brand
  flows are unaffected. New backend endpoints covered by `meals-p2`.

## Production posture
- PRODUCTION-IMPACTING (brand-web app + backend/src) but **not pushed**
  — bundled into the single end-of-program prod push. UI-governed →
  this contract carries `mockup_locked` + `06-diff/notes.md` so
  gov-check Rules 3+4 are satisfied at push time.

## Forward dependencies
X1 adds the AI "suggested offers" feed into the Setup tab. P3's richer
engine changes how prices/decay compute (the UI already reads computed
values). P-REV adds revenue columns to the dashboard.
