# Impact — concept-p1-engine

**Verdict: production-impacting (backend + brand-web + DB migration), purely
ADDITIVE — zero existing behaviour changes anywhere.**

- DB: 3 new tables + seeds; no ALTER on any existing table; idempotent
  (IF NOT EXISTS / ON CONFLICT DO NOTHING). `concepts` ships empty.
- Backend: one new service + controller + route file, mounted under /admin
  with the existing sections capability. No existing file's behaviour changes
  (routes/index.js gains one require + one mount). Preview runs the SAME
  library_products evaluator already serving follower shelves, platform-scoped
  read-only — same load profile as the existing section-library preview.
- brand-web: 2 new pages + 7 api wrappers + 2 nav entries. No existing page
  touched except layout.js NAV (additive rows).
- Follower app: untouched. Nothing reads concepts yet (P4 does).
- Mobile: untouched — NO OTA needed this phase.
- Rollback: hide the nav entries; tables are inert without readers.
