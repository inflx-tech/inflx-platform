# 05 — Impact: Phase 5e/5f Store + Checkout Sweep

**Verdict: zero functional disturbance — color tokens only. Mobile OTA, no backend/DB/API.**

## Mechanics
StyleSheet color values only, white → `C.onGold` (or ink rgba on the wallet):
- `DealsScreen.js` — `chipTxtOn`, `pillTxtOn`.
- `OrderHistoryScreen.js` — `tabTxtOn`.
- `RestaurantDetailScreen.js` — `abtnTxt`.
- `components/ErrorBoundary.js` — `btnTxt`.
- `MeScreen.js` — `wl`, `wb`, `wa`, `rbTxt`.
- `BrandStoreScreen.js` — NO change (verified palette-consistent).

## Blast radius
- Six screens, color tokens only; no JSX/logic/layout/navigation change.
- Deploy-class: production-impacting (OTA runtime) → explicit founder go at the
  joint 5→6 verify; `released:false` meanwhile.
- Deferred (production-impacting, separate go): Brand-Store→section-engine
  migration; Phase 6 banner-gateway + hero-tiles.
- Risk: negligible.
