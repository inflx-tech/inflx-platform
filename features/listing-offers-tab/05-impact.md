# Impact — listing-offers-tab

**Verdict: zero functional disturbance — navigation/reachability fix only.**

- Frontend-only (brand-web). No backend, no migration, no OTA.
- `OffersLibrary` moves file VERBATIM (component + constants + scoped CSS);
  both mounts render the same code. Scoped `.ofl` CSS cannot clash with the
  listing page's `.lst` scope.
- `products/page.js` shrinks by the moved block; its Offers sub-tab keeps
  working via the import (non-drill-down brands unaffected).
- `listing/page.js`: one new tab + conditional header suppression + `?tab=offers`
  init. Browse/Add flows untouched.
- Risk: import path depth (components dir is one level deeper → `../../../../`);
  verified against sibling components' imports.
- Rollback: revert one commit.
