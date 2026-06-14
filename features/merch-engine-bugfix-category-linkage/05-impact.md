# 05-impact

**Verdict: functional fix — category screens stop leaking; admin linkage now real. Low blast radius.**

- Affected: section-engine feeds that pass a `categoryKey` (category screen,
  creator-category screen, any global shelf carrying `category_key`).
- Behaviour change is a *narrowing* (removes wrongly-included businesses) — never
  widens visibility; visibility gate (pushed/allocated) unchanged.
- `groom/travel/events` and legacy `category_key` shelves: identical output via
  fallback. `eat/shop/fitness/home`: corrected (were leaking everything).
- No DB write, no migration, no API/response-shape change → mobile/web clients
  need no update; effect is immediate on backend redeploy.
- Resilience: DB read failure falls back to old CATEGORY_MAP (no empty screens).
- Production-impacting (backend/src) → explicit founder go before deploy.
