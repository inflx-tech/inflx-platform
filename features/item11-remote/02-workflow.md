# item11-remote — workflow

The order is the approval's. **Nothing in 2c starts until 2a and 2b are finished and proved.**

## Phase 0 — the baseline
`npx jest --runInBand --json --outputFile=backend/baseline_item11.json`, before any change.
`backend/scripts/compare-tests.js` committed. Real figures into the gap report §13.

## Phase 2a — fixes, privacy, retirements
1. `production.controller.js` `getContractParties`: `b.id AS brand_id` — the handover defect.
2. **Privacy, before any `ship_to_*` column exists:**
   - `getProduction` — a field whitelist, never the whole row.
   - `listCampaignProduction` — a field whitelist; the gate stays a column, the address does not.
   - `influencer.controller.js:1531` — drop `ci.delivery_address`.
   - `ProductionSection.js:29` — drop the `delivery_address` read.
3. `production.service.js:210-233` — delete the `delivery_address` prefill block.
4. `productionCopy.js` — `MSG.WRONG_MODE_VISIT`, and `assertRemoteMode` beside it.
5. **Retirements, server-side:** `dispatch`, `confirm-received`, `complete` (**shipment/remote
   branch only** — §2.9 found a live Store Visit caller), `items/:itemId/drop`, the shipment
   halves of `accept` / `counter-propose`, `production-shipment-reminder.job` (unregistered),
   the admin production-queue page, the brand website's shipment panel → a read-only card.
   Columns and data stay. `flip-to-remote` and `/initialise` stay refused.
6. Tests: the route-table loop (checks 42, 43, 60). Baseline compare.

## Phase 2b — the shipping layer (its own commit)
Migration **191**; `backend/src/services/shipping/` (`contract.js`, `index.js`, `simulator.js`,
`shiprocket.js`, `webhook.js`); `shipments`, `shipment_events`, `brand_branch_pickups`,
`brand_dues`; the four `wallet_tx_type` values (non-transactional preamble); R18 + the `shipping`
capability. Tested on its own — coverage, quote, book, cancel, return, label, the webhook's
idempotency and order-tolerance, the adapter making no call, and the **zero-imports rule** —
before any feature uses it (checks 33–36, 48, 49, 58).

## Phase 2c — the Remote flow
F1 read (both sides) · F2 coverage · F3 address · F4 correct · F5 picker · F6 lines · F7 quote ·
F8 book · F9 label · F10 cancel · F11 rebook · F12 check · F13 report (three kinds) · F14 done ·
F15 Return → Gift · F16 book the return · `return/sent` (Q1) · F17 confirm · F19 test parcels ·
F20 the admin number. **J1** at `:15`; **J2** — Delayed at `:05` and reminders at `:55` extended.
Notifications (17 keys, `sendSms: false`). Needs You, six moves, both sides.
`invitationRows.service` routes her Active card to the Remote screen.

## Phase 3 — the screens
Brand R1, R5, R6, R6b, R7, R10, R13, R14, R15a, R15b. Creator R2, R3, R4a, R4b, R8, R9, R11,
R12, R16. Admin R17 (no code), R18 (new).

## Phase 4 — tests
Checks 1–41 from the gap-check prompt plus 42–60 from the approval. `compare-tests.js` against
`baseline_item11.json` — **no new failures**. The `stage4-parcel.test.js` drift listed, each
moved into a `retired` block naming this item; **none deleted silently**. Governance check.

## Not without a word from the founder
No migration applied to production, no push, no OTA, no Render environment variable, no courier
call, no money moved, nothing created or marked in production.
