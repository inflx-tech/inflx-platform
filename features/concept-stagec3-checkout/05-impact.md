# Impact

**One-line verdict: additive backend (2 columns w/ defaults + one shared
extract of the existing verify path) + one new mobile screen; prepaid
orders, food flow, money math and settlement all byte-identical.**

- Migration 144 additive with defaults — every historical row reads
  'prepaid', which is true.
- settleOrders() is a pure extraction of verifyOrder's tail (write loop +
  notifications + response); verify behaviour unchanged, COD reuses it —
  one code path, no drift.
- COD risk accepted and bounded: commission credits at order time (as
  prepaid does) but sits in pending_balance behind the 30-day return
  window; a refused COD delivery claws back through the same rails.
  COD fee never enters brand_net or commission.
- Mobile: CartScreen sheds the payment modal + order machinery (moved,
  not duplicated — the order-item shape is verbatim); ReviewOrder is the
  only new navigation node (SHARED_SCREENS, no duplicate route names).
- Admin page: extends the existing App Settings page; PATCH is the
  existing shallow-merge endpoint.
- Deploy: production-impacting — backend on push (Render), brand-web
  admin on push (Vercel), mobile via OTA. Endpoints/knobs going live
  before the OTA is harmless (old bundles never send payment_method).
