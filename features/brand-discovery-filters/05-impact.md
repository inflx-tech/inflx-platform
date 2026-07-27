# Impact — discovery step 2
**Frontend-only, brand-web (Vercel) — zero backend.**
- One debounced useEffect replaces the initial-search effect; tier chips drop inline doSearch.
- Same search endpoint/params; only the trigger changes.
Risk: low-moderate — debounced live search (guard against fetch storms via 400ms debounce +
single source). Build-validated.
Release: production-impacting via Vercel → founder go; web verify on deployed dashboard.
Note: sliders + pick-from-list chips = step 2b.
