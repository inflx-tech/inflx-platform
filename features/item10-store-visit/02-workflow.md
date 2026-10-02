# item10-store-visit — workflow

The order is the approval's, and **2b does not start until 2a is proved**.

## Phase 2a — the gate and the mode (backend)
1. `services/shootGate.service.js`: `shootGate(ciId)`, `assertShootOpen(contractId)`,
   `assertShootOpenForEvent(eventId)`; the copy in `productionCopy.js`.
2. `productionMode.model.js`: `resolveProductionMode({ setMode, contractMode, agreementMode })`.
3. `production.service.js`: `autoCreateForContract` reads the set's mode and branch, asserts the gate.
4. `production.controller.js`: the guard on every surviving path; `'live'` removed from the roster's status list; the brand list filtered; the admin queue gains the gate column.
5. `influencer.controller.js`: the deliverable heal keys on the two signatures.
6. `campaignState.validateSetInput`: a Store Visit branch must have a street address.
7. `primitives.js`: `DangerButton` honours `busy`.
8. Migration 187 + `scripts/run-187.js --dry | --apply | --fix-modes`.
9. Tests: the loop over the route table (checks 1–3, 31–33, 35–37, 45, 48). Baseline compare.

## Phase 2b — the third anchor (one commit)
Migration column (in 187), `loadShootContext`, `anchorOf`, the `{visitAt}` subject in
`termsOf/normalizeSnapshot/canon/termsLine/changesBetween`, `reopen`, `can.decline=false`, the
switch ignored. Tests on `canon` directly and through the engine (checks 11–14, 38–42).

## Phase 2c — the shoot flow
F1 read (both sides), F2+F3 send, F4 accept, F5 thread, F6 move, F7 attended, F8 confirm; jobs
`shoot-auto-confirm` (:45), `collab-delayed` (:05), `shoot-reminders` (:55); `shoot_auto_confirm_days`;
`productionCopy.NOTIFY`; Needs You step 3 from one rule; admin queue projection; `/brands/me/shoots`.

## Phase 2d — the retirements
Slot dance (`propose-slot`, `accept`, `counter-propose`, `setVisitDetails` for visit), `flip-to-remote`,
`/initialise`'s mode choice, `visit_maps_url`; brand-web visit panel → read-only card.

## Phase 3 — the screens
Brand V1–V3, V7, V10–V14; Creator V4–V6, V8, V9, V15. Token pass on `ShootParts.js`; the eighth
`Delayed` tone; `DateTimeChipPicker` restyled, 15-minute steps, max = posting date. The Stage-4
guard test that refuses a native picker import **stays**.

> **Corrected 2 Oct 2026 (features/ui-walk-fixes, board G).** That guard test did not exist when
> this was written; it now does (`shoot10.test.js`, "no file in the app imports the Android date or
> time picker"). The chip picker itself was replaced by two boxes, Date and Time, at the founder's
> request — Q8's "chip" half is superseded, its "no Android clock" half is kept.

## Phase 4 — tests and evidence
Checks 1–48, `compare.js baseline_item10.json after-item10.json`, governance check, `06-diff/notes.md`.

## Deploy (after the founder's explicit go)
migration 187 dry-run shown → `--apply` → `--fix-modes` dry-run shown → `--fix-modes --apply` →
commit → push (Render + Vercel) → OTA brand, then OTA influencer.
