# Impact Analysis — Shiprocket connector repair

> Step 6. Generated BEFORE writing implementation code.

## Verdict
Backend only, no migration, no screen. **Nothing changes in production while the two switches
are off** — except that the update address gains a second name and one cancel path becomes
stricter for a real courier (there are no real-courier parcels today).

## Affected files (read or change)
- backend — changed:
  - `src/services/shipping/shiprocket.js` — rewritten against the published reference.
  - `src/config/env.js` — one new optional setting, `SHIPROCKET_RATES_EXCLUDE_GST`.
  - `src/controllers/shippingWebhook.controller.js` — `courier` is a second name for the
    Shiprocket update address.
  - `src/services/remoteParcel.service.js` — the booking passes the store's registered code;
    a failed booking logs why; a real courier that will not cancel stops the refund.
  - `src/services/remoteReturn.service.js` — the return booking passes its items; a return the
    courier could not book is withdrawn so she can book again.
  - `src/jobs/shipping-weight-sync.job.js` (new) + `src/jobs/index.js` — the daily read.
- backend — read, not changed: `shipping/index.js`, `shipping/webhook.js`, `shipping/contract.js`,
  `shipping/simulator.js`, `remoteEffects.js`, `remoteMoney.service.js`, `routes/webhook.routes.js`.
- tests — new: `tests/shiprocket-connector.test.js`.
- web / mobile / shared: none.

## Affected routes / APIs
| Method | Path | Change | Consumers |
|---|---|---|---|
| POST | `/v1/webhooks/shipping/courier` | new name, same handler as `/shipping/shiprocket` | Shiprocket |
| POST | `/v1/webhooks/shipping/shiprocket` | unchanged | nobody yet |
| POST | brand "cancel booking" (item 11 F10) | 502 "could not be cancelled just now" when a REAL courier refuses — was: refund anyway | brand app |
| POST | creator "book return" (item 11 F16) | 502 "could not be booked just now" when the courier refuses — was: an unhandled error that left her unable to rebook | creator app |

## Affected workflows (regression surface)
Item 11 Remote, end to end on the simulator — must be unchanged:
- `backend/tests/shipping-layer.test.js` (isolation rule, check 34 "no call while off", webhook)
- `backend/tests/item11-test-parcels.test.js`, `item11-remote-flow.test.js`,
  `item11-remote-return.test.js`, `item11-phase2a.test.js`, `stage4-parcel.test.js`

## Migration / deploy / OTA impact
- No migration. No OTA. No APK.
- Push redeploys Render (backend) — and Vercel, with no website change in it.
- Render settings already saved by the founder on 6 Oct: `SHIPROCKET_EMAIL`,
  `SHIPROCKET_PASSWORD`, `SHIPROCKET_WEBHOOK_SECRET`. Still unset, on purpose:
  `SHIPPING_PROVIDER`, `SHIPROCKET_ENABLED`.

## Risk notes
- **Money.** Two changes can only keep money where it is: a refused booking now charges nothing
  (it used to look booked), and a refused cancel now refunds nothing (it used to refund while the
  courier was still coming). The brand-facing price rounds up instead of to nearest — at most 99
  paise per parcel, in INFLX's favour.
- **The daily weight read charges a brand's wallet** through item 11's existing weight-charge
  rule. It reads the difference between "charged" and "applied" totals as the extra. That reading
  is from the reference, not from a real case — to be watched on the first real difference.
- **Not provable without the account:** the five points listed at the foot of `01-spec.md`.
  The tests prove INFLX sends what the reference requires; they cannot prove Shiprocket behaves
  as its reference says.
- Rollback: revert the commit. Nothing is stored in a new shape that an older build cannot read
  (a `shipment:order` reference is only ever read by this connector, and no such row exists).
