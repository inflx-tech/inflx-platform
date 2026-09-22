# Item 11 — The Remote shoot: Phase 1 gap report

**Status:** Phase 1 only. Read and report. No code changed, no migration run, no data touched,
no courier called, no money moved. Production was read with `SELECT` only.

**Sources, in order of authority:** `INFLX_Master_Business_Rules_Phase_1_v1.26.docx` §11.2 (with
2B, 2C, 7A, 7B, 9, 10, 11.1, 12, 13, 17, 20, 24, 25, 26, 27, 28, 32) → `INFLX_Item11_Remote_Mockups.html`
(R1–R18 and the rules table) → the gap-check prompt. Every claim below cites `file:line` in
`C:\WORK\inflx-platform`.

---

## 1. Summary

| Area | Status | The gap in one line |
|---|---|---|
| **`addParcelItems`' `brandId`** | **Broken today** | `contract.brand_id` is `undefined` — `getContractParties` never selects it, so the brand's add-products call can only ever answer "not in your catalogue". |
| The gate (`assertShootOpen`) | **Ready, reusable, mode-agnostic** | `shootGate.service.js` already guards every existing door; item 11 must ask it on ~22 new ones plus 2 job lanes. |
| The mode | **Ready one way only** | Item 10 refuses a Remote collaboration with `WRONG_MODE`; there is **no mirror** refusing a Store Visit on a Remote path — that message does not exist yet. |
| Existing parcel code | **Partial, keep the spine** | `production_event_items` (161) is the right table and holds her per-item verdict; it has **no variant, no Return/Gift, no return-leg, no quantity cap, no brand return-check**. 0 rows in production. |
| Shipment columns on `production_events` | **Legacy, retire in place** | 11 loose `shipment_*` columns from migration 024, hand-typed courier/AWB. One production row carries a typed `Delhivery / DL8829174C` on an **unsigned** contract. |
| Her delivery address | **Missing entirely** | No creator street address exists anywhere on the platform. `campaign_influencers.delivery_address` is a free-text legacy column, **0 of 19 rows populated**, and its auto-copy path is a live privacy hazard. |
| Courier / shipping layer | **Missing entirely** | Zero courier API code, zero Shiprocket/Delhivery client, zero env vars. Couriers are typed by hand on the brand website. |
| The money | **Partial** | Debit + audit row exists (`contractSign.service.js:126-150`). A **lock that is not an escrow tranche**, a **partial release**, and **"owed"** do not exist in any form. `wallet_tx_type` has no courier value. |
| Returns (Remote) | **Missing** | `remote_return_days` (7) exists and is stamped on the Agreement; nothing reads it after that. `returns.*` in the repo is **customer order returns**, unrelated. |
| Delayed | **Ready, hard-coded to `visit`** | `collab-delayed.job` filters `COALESCE(pe.mode, cs.shoot_mode) = 'visit'`; the CHECK constraint on `delayed_stage` allows five visit/content values and would **reject** every Remote stage. |
| Reminders (48h) | **Ready, hard-coded to `visit`** | `shootPlan.remind` selects `pe.mode = 'visit'` and only knows the plan/thread turn. |
| Needs You | **Ready, hard-coded to `visit`** | Both sides' counts filter `pe.mode = 'visit'` / `pe_shoot_mode === 'visit'`. |
| Admin numbers | **Ready** | `platform_settings` is data-driven end to end; R17 is one row in `DEFAULTS` + one `INSERT`. `remote_return_autoconfirm_days` is missing. |
| Admin Test parcels (R18) | **Missing** | New page; the admin shell, `requireCapability` and the API client pattern all exist. |
| Notifications | **Ready** | `notification.service.send` + the `productionCopy.NOTIFY` pattern. 17 new keys to add; none exist. |
| Phone apps | **OTA-safe** | No new native module. The PDF label rides `Linking.openURL(signedUrl)` — the exact pattern items 7 and 9 already ship. |
| Privacy | **Three live leak vectors** | `getProduction` returns the whole `production_events` row to either party with no field whitelist; `listCampaignProduction` emits `shipment_to_*` with the gate as a *column*, not a filter; `influencer.controller.js:1531` returns `ci.delivery_address`. |
| Money reality | **Blocker for testing** | Every brand wallet in production is **₹0.00**. Nothing can be booked until the founder tops one up. |

---

## 2. Requirement table

**Status key:** E exists · P partial · M missing · C conflicts

### 2.1 Data (§4)

| ID | Requirement | St | Evidence | Proposed change | Risk |
|---|---|---|---|---|---|
| D1 | Remote Shoot Plan, one per collaboration, stage derived from timestamps | **P** | `production_events` one row per contract (`024_production_coordination.sql:24-26`); item 10 derives its stage in `shootPlan.service.js:96-104` | Add Remote timestamps to `production_events`; a `remoteStageOf()` beside `stageOf()` | Low |
| D1 | Address sent at | **M** | — | `pe.address_sent_at` | Low |
| D1 | Address corrected at | **M** | — | `pe.address_corrected_at` | Low |
| D1 | Shoot done at, no brand confirmation | **E** | `pe.influencer_completed_at` (`164_shoot_two_sided_completion.sql:27`); `parcel.isShootComplete` already returns creator-alone for `shipment` (`parcel.service.js:67-73`) | Reuse unchanged | None |
| D1 | Delayed flag | **E/C** | `campaign_influencers.delayed_at` / `delayed_stage` (`187_item10_store_visit.sql:64-71`) | **The CHECK must be widened** — it lists only `plan_not_sent, time_not_agreed, not_attended, not_confirmed, content_not_live` and would reject all five Remote stages | Medium — a job insert would throw |
| D2 | Her name, number, street, pincode, state, city, note, sizes | **M** | No creator street address anywhere. Census: `information_schema` has no address column on `influencers`; `ci.delivery_address` is free text with **0 / 19** populated | New `pe.ship_to_*` snapshot columns (§8) | Low |
| D2 | State and city stored as references | **E** | `influencers.city_id` / `state_id` (int / smallint → `ref_cities` / `ref_states`, migration 171); `referenceLists.service.js:69` serves the offered lists | Copy the ids onto the snapshot, plus the names as sent | Low |
| D2 | Coverage result at send | **M** | — | `pe.coverage_delivers`, `pe.coverage_return_pickup`, `pe.coverage_checked_at` | Low |
| D2 | Snapshot, immune to profile change | **M** | Item 10 sets the precedent for the branch address (`187…sql:48-49`) | Same pattern | Low |
| D2 | Privacy — brand only, after send | **C** | `production.controller.js:180` returns `production_event: event` **whole** to either party; `production.controller.js:574-576` emits `shipment_to_*` with the gate as a column | A field whitelist on both, before any address column lands | **High** |
| D3 | One outbound parcel per collaboration | **P** | `production_event_items.parcel_no` exists and deliberately allows many (`161…sql:50-51,71-74`) | A `shipments` table with a partial unique index on `(production_event_id) WHERE direction='outbound' AND cancelled_at IS NULL` | Medium |
| D3 | Direction outbound / return | **M** | — | `shipments.direction` | Low |
| D3 | Pickup branch | **E** | `brand_branches` (172), exactly one main (`uq_brand_branches_one_main`) | `shipments.branch_id` + a snapshot of the pickup address | Low — but **4 of 11 live branches have no street address and no pincode** |
| D3 | Box preset / typed dimensions, weight | **M** | — | `shipments.box_preset`, `box_l/w/h_cm`, `weight_kg` | Low |
| D3 | Provider, recorded, never changed | **M** | — | `shipments.provider` + a `CHECK` and no UPDATE path | Low |
| D3 | Courier, tracking number, label | **P** | `pe.shipment_courier` / `shipment_awb` exist but are **typed by a human** on the website (`Packages/brand-web/app/dashboard/campaigns/[id]/influencers/page.js:580-588`) | New columns on `shipments`, written only by the provider | Low |
| D3 | Price as quoted and as charged | **M** | — | `shipments.quoted_amount`, `charged_amount`, `gst_included` | Low |
| D3 | The nine timestamps | **P** | 4 exist on `production_events` (dispatched / expected / delivered / received_confirmed) and are hand-set | New on `shipments`; leave the four legacy ones alone | Low |
| D3 | Rebooked once | **M** | — | `shipments.rebooked_from_id` + one-hop check | Low |
| D4 | Product + variant | **P** | `production_event_items.product_id` exists (`161…sql:40`); **no `variant_id`**. `product_variants` (047) exists but has **0 rows in production** | Add `variant_id` nullable → `product_variants(id)`; snapshot size/colour | Medium — see Q4 |
| D4 | Quantity 1–5, ≤ 20 lines | **C** | `quantity > 0` unbounded (`161…sql:48`); `addItems` caps at **50** lines (`parcel.service.js:98-100`) and refuses duplicate product ids (`:102-105`) | Enforce 1–5 and ≤ 20 in the item-11 service; leave the old constraint | Low |
| D4 | Return or Gift per line, with a change log | **M** | — | `pei.disposition` + `disposition_changed_at` / `_by`, and a row in `production_event_log` | Low |
| D4 | Her check received / missing / damaged, note ≤ 300 | **E/P** | `receipt_status`, `receipt_note`, `answered_at` (`161…sql:57-59`), written by `parcel.recordReceipt` (`parcel.service.js:155-188`) | Reuse; add the 300-char rule (there is none today) | Low |
| D4 | Returned on the return | **M** | — | `pei.returned_on_shipment_id` | Low |
| D4 | Brand's return check, or auto-confirmed | **M** | — | `pei.return_status`, `return_checked_at`, `return_auto_confirmed_at` | Low |
| D4 | Reported to INFLX | **M** | — | `pei.reported_at` / `reported_by`; and an event-level `pe.difference_reported_at` | Low |
| D4 | The list locks at booking, reopens on cancel | **P** | Today the only lock is `if (event.shipment_dispatched_at)` on **remove** (`production.controller.js:748-752`); **add** has no lock at all | One `assertListOpen()` on every write | Medium |
| D5 | Outbound debit from available balance | **P** | The shape exists: `UPDATE brands SET wallet_balance` + a `wallet_transactions` row (`contractSign.service.js:126-150`) | New `wallet_tx_type` values (§7) | Low |
| D5 | Return lock, partial release | **M** | Locking today **is** an escrow tranche (`escrow.service.js:64`, three rows, tranche numbers) — wrong shape for a courier hold | A `shipping_holds` table, or `shipments.return_hold_amount` + a `courier_lock` / `courier_lock_release` ledger pair | Medium |
| D5 | Cancel returns both | **M** | — | One transaction, two credits | Low |
| D5 | Return-to-store charge, weight charge | **M** | — | `courier_charge` debits with the courier's reason | Low |
| D5 | **Owed** when short | **M** | Grepped the whole backend: no dues, no negative balance, no arrears. `brands.wallet_balance numeric(12,2) DEFAULT 0` (`001_initial_schema.sql:135`) is the only figure | `brand_dues` table (§7) | Medium |
| D5 | Never the creator, never the locked fee | **E** (to prove) | `contracts.locked_amount` is written only at the brand's signature (`contractSign.service.js:155-165`) and reduced only by tranche release | A balances-and-ledger before/after test | Low |
| D6 | Due date = stamped window after the later of posting date and shoot done, India time | **P** | The window is stamped: `contracts.terms_json->'returnTerms'->>'days'` (`agreementTerms.service.js:291-294`); `campaign_sets.go_live_date`; `indiaDay.js` has `calendarDay / todayInIndia / addDays / daysBetween` | Derive, do not store | Low |
| D6 | Booking from shoot done, day from tomorrow | **M** | — | New endpoint + `shipments.pickup_day` | Low |
| D6 | Auto-confirm, new Admin number, stamped at delivery to the branch | **M** | The pattern is item 10's exactly (`shootPlan.attended` stamps `auto_confirm_days` + `auto_confirm_due_at`, `shootPlan.service.js:380-385`) | `remote_return_autoconfirm_days`; stamp on the **return shipment** at its delivered event | Low |
| D6 | Overdue derived, not stored | **M** | — | Derived in the read; the reminder lane owns the nudge | Low |
| D7 | Needs You, six moves, one rule both sides | **P** | `collabCounts.service.js:155` (creator side) and `:245-254` (`shoot_to_answer`) both filter `mode = 'visit'`; the brand tree is `brandInbox.controller.js:192` | Extend both with the Remote moves | Medium |
| D8 | Delayed with five Remote stages | **P/C** | See D1 — the CHECK rejects them | Widen the CHECK; extend `delayedStageOf` | Medium |
| D9 | The shipping layer | **M** | Nothing. `grep -i 'shiprocket\|delhivery\|logistic'` over `backend/src` returns one comment and zero calls | New `backend/src/services/shipping/` (§6) | Medium |
| D10 | The simulator | **M** | The house mock pattern is `X_MOCK` defaulting true (`config/env.js:42,74,84,92,103`) | `SHIPPING_PROVIDER=simulator` default | Low |
| D11 | The Shiprocket adapter, switched off | **M** | No env var exists | §6.4, plus the founder list in §14 | Low |
| D12 | `remote_return_autoconfirm_days`, default 7, audited | **M** | `platform_settings` + `platform_settings_audit` (`182…sql:94-119`); the page is data-driven (`Packages/brand-web/app/admin/settings/platform/page.js:44-51`) | One `DEFAULTS` entry + one description + one `INSERT … ON CONFLICT DO NOTHING` | **None** |
| D13 | 17 notification keys | **M** | `notification.service.send` (`notification.service.js:26`) and `productionCopy.NOTIFY` (`productionCopy.js:71-81`) | 17 keys in a `remoteCopy.js` or an extended `productionCopy.js` | Low |
| D14 | Legacy data | **E** | See §2.3 and the census in §13 | **No backfill.** All five live Remote shoots read "waiting for her address" | None |

### 2.2 API (§5) — condensed; full shapes in §9

| ID | St | Nearest thing today |
|---|---|---|
| F1 Remote shoot state | **M** | `shootPlan.read` (`shootPlan.service.js:140-235`) is the exact shape to mirror |
| F2 Coverage check | **M** | — |
| F3 Send the address | **M** | — |
| F4 Correct the address | **M** | — |
| F5 Product picker | **P** | `follower.service.resolveAllocatedProductIds` (`:313-370`) is the scope→products resolver; no brand-facing picker endpoint |
| F6 Save the lines | **P/C** | `POST /production-events/:id/items` exists and is **broken** (`production.controller.js:721-738`) |
| F7 Quote | **M** | `agreement.service.js:208-231` is the shortfall pattern to copy |
| F8 Book | **M** | — |
| F9 Label | **M** | `pdf.service` + `storage.getPdfDownloadUrl` (`storage.service.js:37`) |
| F10 Cancel | **M** | — |
| F11 Book again | **M** | — |
| F12 Her check | **P** | `parcel.recordReceipt` (`parcel.service.js:155`) via `POST /production-events/:id/confirm-received` |
| F13 Report to INFLX | **M** | — |
| F14 Shoot done | **P** | `POST /production-events/:id/complete` (`production.controller.js:490-530`) — works for `shipment`, but has no "check first" rule and no gate on the mode message |
| F15 Return → Gift | **M** | — |
| F16 Book the return | **M** | — |
| F17 Brand confirms the return | **M** | — |
| F18 Webhook | **P** | `/v1/webhooks/razorpay` shows the raw-body + HMAC pattern (`webhook.routes.js:29`, and `app.js` skips JSON on `/v1/webhooks/*`) |
| F19 Admin Test parcels | **M** | — |
| F20 Admin number | **E** | `PATCH /admin/platform-settings` (`item6.routes.js:44`) — no code change |
| J1 Return auto-confirm | **M** | `shoot-auto-confirm.job.js` is the template |
| J2 Delayed + reminders extended | **P** | `collab-delayed.job.js`, `shoot-reminders.job.js` |

### 2.3 Legacy data (D14)

Production, read 22 Sep 2026, `SELECT` only:

| Fact | Count |
|---|---|
| Signed collaborations by set mode | **shipment 5**, visit 2, NULL 1 |
| `production_events` by mode/status | shipment/confirmed **6**, visit/completed 3, visit/confirmed 2, visit/proposed 1 |
| `production_event_items` rows | **0** |
| Parcel rows on an unsigned contract | 0 |
| Events with any `shipment_*` value | **1** — a hand-typed `Delhivery` / `DL8829174C` on a contract with **neither signature** |
| `campaign_influencers.delivery_address` populated | **0 of 19** |
| `physical_delivery = true` | **0** |
| Collaborations flagged Delayed | 0 |
| `product_variants` rows | **0** |
| `brand_products` | 48 total, 41 active, 48 pushed |
| `brand_branches` | 11 rows, 11 mains, **4 with no street address and no pincode** |
| Brand wallets | 11 brands, **₹0.00 total** |
| `alloc_scope` on signed | store 5, category 1, NULL 2 |

All five signed Remote collaborations belong to **Kanchi Silks (practice)**: one Pay for Sale
(`locked_amount 0.00`, posts 22 Sep), two Hybrid (₹4,000 / ₹8,500, posts 29 Sep), two Pay for
Content (₹12,960 / ₹10,800, posts 22 / 29 Sep). The sixth shipment event is the unsigned one —
gate-closed, so it appears nowhere.

**On the new screens, with no backfill:** all five show R1 / R2, "Waiting for her address", Pick
products disabled. The unsigned sixth stays invisible. **Nothing needs backfilling.**

---

## 3. What already exists, in detail — keep / extend / retire

### 3.1 The handover defect, first

**`production.controller.js:727` — `brandId: contract.brand_id` is `undefined`.**

`contract` comes from `getContractByEvent` → `getContractParties`
(`production.controller.js:40-66`). Its `SELECT` names `camp.name AS campaign_name`,
`b.business_name AS brand_name` and joins `brands b ON b.id = camp.brand_id`
(`:59`) — **but never projects `b.id`**. So:

```
parcel.addItems(eventId, { brandId: undefined, … })
  → SELECT … FROM brand_products WHERE brand_id = $1 AND id = ANY($2::uuid[])   (parcel.service.js:109-113)
  → node-pg sends NULL → zero rows → byId is empty → every id is "missing"
  → 422 "Some of those products are not in your catalogue."                      (parcel.service.js:117)
```

The brand's add-products call **cannot succeed for any product**. Nothing masked it because no
parcel has ever been packed in production (0 rows) and the path is only reachable on a `shipment`
event, which until item 10's mode fix (18 Sep) never existed — every set-first shipment resolved
to `'remote'`.

**Fix (Phase 2a):** add `b.id AS brand_id` to the `SELECT` at `production.controller.js:46-63`.
One line. It also repairs `dropItem`'s allocation path, which reads the same row.

Check 40 in §12.1 ("`addParcelItems` works for the owning brand and is refused for any other")
is satisfied by that plus the existing `ensureParty(contract, req, 'brand')` at `:724`.

### 3.2 Tables

| Table | What it is | Verdict |
|---|---|---|
| `production_events` (024, +039, +164, +187) | One row per contract; 48 columns. Visit half is item 10's and current. Shipment half is 11 columns of hand-typed 2024-era fields. | **Keep as the Shoot Plan.** Add the Remote timestamps and the address snapshot. **Retire in place** the 11 `shipment_*` columns — stop writing them, stop reading them, leave the data. |
| `production_event_items` (161) | What is in the box, her verdict per item, `parcel_no`, `dropped_at`. 0 rows. | **Keep and extend** — `variant_id`, `disposition`, quantity rule, return columns, report columns. |
| `production_event_log` (024) | Append-only action log, `actor_role`, `metadata jsonb`. Item 10 writes to it via `production.service.logAction`. | **Keep, reuse for every Remote action** including webhook events and Test-parcel presses. |
| `campaign_influencers.delayed_at / delayed_stage` (187) | The Delayed flag. | **Keep; widen the CHECK.** |
| `negotiations.production_event_id` (187) | Item 10's time thread anchor. | **Untouched** — Remote has nothing to negotiate. |
| `brand_branches` (172) | Pickup addresses, one main enforced. | **Keep.** 4 of 11 have no address → booking must refuse with item 10's `BRANCH_NO_ADDRESS` message (`productionCopy.js:28`). |
| `product_variants` (047) | size / colour / sku / stock / price_override, `is_active`. 0 rows. | **Keep.** See Q4 — the picker needs a no-variant path. |
| `brand_products` | `is_active`, `pushed_to_store`, `stock`, `price`, `image_url`, `category_node_id`, `section`. | **Keep.** The availability test is `is_active = true AND pushed_to_store = true` (`follower.service.js:333-334, 347`). |
| `platform_settings` / `_audit` (182) | Data-driven admin numbers. | **Keep; one new row.** |
| `wallet_transactions` / `brands.wallet_balance` | The brand ledger. | **Keep; new enum values.** |
| `contracts.terms_json` (183) | The stamped agreement, `returnTerms.days`. | **Read-only for item 11.** |
| `follower_orders.courier_name / tracking_number` (105) | Customer-order shipping, admin-typed. | **Untouched.** Item 16 replaces it with the layer built here. |
| `returns` / `returns.routes.js` | **Customer order returns.** Nothing to do with Remote. | **Untouched.** Do not overload the word. |

### 3.3 Code

| File | Verdict |
|---|---|
| `services/shootGate.service.js` | **Keep, unchanged.** Mode-agnostic by construction — it reads `cs.shoot_mode` only to *report* it (`:59`), never to decide. |
| `services/productionMode.model.js` | **Keep, unchanged.** `resolveProductionMode` puts the set first (`:60-72`); `initialStatusFor` (`:88-90`). |
| `services/shootPlan.service.js` | **Keep.** Item 11 writes a sibling, `remoteShoot.service.js`, with the same shape. Extend `flagDelayed` (`:455-500`) and `remind` (`:507-550`) to both modes. |
| `services/productionCopy.js` | **Extend.** `MSG` gains the Remote refusals, `NOTIFY` the 17 keys, and a `REMOTE_STAGE_LABEL`. |
| `services/parcel.service.js` | **Keep the spine, extend.** `listItems`, `recordReceipt`, `summarise`, `isShootComplete` are all reusable. `addItems` needs the `brandId` fix, the 1–5 / ≤20 rules, the variant, and the disposition. `dropItem` is **not** item 11's model (a missing item is recorded, not dropped) — **leave it, do not call it**. |
| `controllers/production.controller.js` | **Mixed.** `getProduction` (`:150`) **must gain a field whitelist**. `listCampaignProduction` (`:555`) same. `dispatch` (`:398`) and `confirm-received` (`:440`) are the hand-typed flow item 11 replaces → **retire server-side**. `complete` (`:490`) is the nearest thing to F14 but has no "check first" rule → **retire, replaced by F14**. `flip-to-remote` (`:290`) and `/initialise` (`:133`) are **already retired** — confirmed, both call `retiredModeChoice()` before doing anything. |
| `jobs/production-shipment-reminder.job.js` | **Retire.** Daily at 09:30, reads `mode='shipment' AND status='in_progress' AND shipment_dispatched_at`, sends an **SMS** at 14 days (`:63`), asks **no gate**. Item 11's `:55` lane replaces it. |
| `services/production.service.js:210-233` | **Retire that block.** The `delivery_address` prefill. Item 10 already disarmed the pincode half; the address half still copies a legacy free-text field onto the event **at the brand's signature**, before she has sent anything. |
| `utils/indiaDay.js` | **Keep, reuse.** |
| `services/referenceLists.service.js` | **Keep, reuse** for the state/city lists and `ref_cities.lat/lng` (190) for the simulator's distance. |
| `services/storage.service.js` / `pdf.service.js` | **Keep, reuse** for the label. |

### 3.4 Screens

| Surface | Verdict |
|---|---|
| `Packages/brand-web/app/dashboard/campaigns/[id]/influencers/page.js:572-600` | The shipment panel: "Shipping to", a **typed courier box** with a Shiprocket option, a typed AWB, "Mark as dispatched". **Retire server-side** (as item 10 did with the visit panel) — the endpoint behind it is `dispatch`. |
| `Packages/brand-web/app/dashboard/fulfillment/page.js` | Customer-order fulfilment, `COURIERS` hard-coded list. **Untouched** (item 16). |
| `Packages/brand-web/app/dashboard/campaigns/[id]/ProductionSection.js:29` | Reads `ci.delivery_address`. **Retire that line** with the column. |
| `Packages/brand-web/app/admin/production-queue/page.js` | Admin stall queue, fed by the reminder job. **Retire with the job**, or repoint at the new lanes — recommend retire. |
| `Packages/brand-web/app/admin/settings/platform/page.js` | **Keep, no change.** Data-driven; R17 appears by itself. |
| `Packages/Mobile/src/screens/brand/BrandShootScreen.js` | Item 10's. **Keep.** Item 11 adds `BrandRemoteScreen` beside it; `BrandSetDetailScreen.js:111,122,201,209` picks the door by mode. |
| `Packages/Mobile/src/screens/influencer/ShootScreen.js` | Item 10's. **Keep.** `CollabsScreen.js:78` already routes on `item.shoot` — extend the server field to Remote. |
| `Packages/Mobile/src/components/shoot/bits10.js`, `sheets10.js`, `copy10.js` | **Keep, reuse** — `GateCard10`, `StepLine10`, `TimeCard10`, `Row10`, `DelayedChip10`, `AmberBox10`, `GreenBox10`, `WaitBox10`. |

---

## 4. The gate and the mode on every Remote path

`assertShootOpen(contractId)` → `shootGate.service.js:95-99`. Variants:
`assertShootOpenForCollab(ciId)` (`:102`), `assertShootOpenForEvent(eventId)` (`:107`),
`shootGateMany(ciIds)` for lists (`:74`). Messages: `productionCopy.MSG.NOT_SIGNED` /
`NOT_FUNDED` (`productionCopy.js:15-16`) — **verbatim the two sentences in §7**.

**It is mode-agnostic.** `GATE_SQL` selects `cs.shoot_mode` and `decide()` reports it as
`shootMode` (`shootGate.service.js:27,59`) but never branches on it. Nothing to change.

**The mode check does not exist in the Remote direction.** `productionCopy.MSG.WRONG_MODE`
(`:18`) reads *"This is a Remote collaboration. Products are shipped to {name}."* — that is item
10 refusing a Remote row. §7 requires the mirror on every Remote endpoint:
*"This is a Store Visit collaboration. {Brand} send a time and the store address."* — **new copy key.**

### 4.1 The route table

| # | Route | Exists | Gate today | Mode today | Item 11 |
|---|---|---|---|---|---|
| 1 | `GET /contracts/:id/production` | yes | ✅ `:153` | none | **Whitelist fields**; keep |
| 2 | `GET /campaigns/:id/production` | yes | column only, `:596` | none | **Whitelist fields** |
| 3 | `GET /contracts/:id/production/date-range` | yes | ✅ | none | keep |
| 4 | `POST /contracts/:id/production/initialise` | yes | ✅ then **retired** | n/a | confirm still refused |
| 5 | `POST /contracts/:id/production/visit-details` | yes | ✅ | visit only | untouched |
| 6 | `POST /production-events/:id/propose-slot` | yes | ✅ (via `getEventOrThrow`) | visit retired | **refuse on Remote** |
| 7 | `POST /production-events/:id/accept` | yes | ✅ | visit retired, **shipment live** | **retire the shipment half** |
| 8 | `POST /production-events/:id/counter-propose` | yes | ✅ | visit retired | **retire the shipment half** |
| 9 | `POST /production-events/:id/dispatch` | yes | ✅ | shipment | **retire** → F8 |
| 10 | `POST /production-events/:id/confirm-received` | yes | ✅ | any | **retire** → F12 |
| 11 | `POST /production-events/:id/complete` | yes | ✅ | any | **retire** → F14 |
| 12 | `POST /production-events/:id/flip-to-remote` | yes | ✅ then **retired** | n/a | confirm still refused |
| 13 | `POST /production-events/:id/cancel` | yes | ✅ | admin | keep |
| 14 | `GET /production-events/:id/items` | yes | ✅ | any | keep, extend the shape |
| 15 | `POST /production-events/:id/items` | yes | ✅ | any | **fix `brandId`**, then F6 replaces it |
| 16 | `DELETE /production-events/:id/items/:itemId` | yes | ✅ | any | keep behind the booking lock |
| 17 | `POST /production-events/:id/items/:itemId/drop` | yes | ✅ | any | **retire** — not item 11's model |
| 18 | `GET /brands/me/shoots` | yes | ✅ filter, `:684-687` | visit stage only | extend with the Remote stage |
| 19–40 | **F1–F20, J1, J2** | no | — | — | **all new; every one behind the gate + the mode check** |

Both retired doors were verified: `flipToRemote` calls `retiredModeChoice()` at
`production.controller.js:290` before touching the service, and `initialiseProduction` returns it
at `:139`. Both throw `RETIRED_MODE_CHOICE` 422 —
*"The mode of work comes from the set and cannot be chosen or changed inside the shoot plan."*

---

## 5. Link readiness (§3), row by row

| Link | Ready? | What is missing | What item 11 consumes / exposes |
|---|---|---|---|
| **Item 10: the gate** | **Ready** | nothing | Consumes `assertShootOpen` on ~22 routes + 2 jobs |
| **Item 10: the mode** | **Half** | the Store-Visit-refusal message and the check on Remote paths | Consumes `cs.shoot_mode` via the gate's `shootMode` |
| **Item 10: Delayed** | **Half** | the `delayed_stage` CHECK rejects all five Remote values; `flagDelayed` filters `= 'visit'` (`shootPlan.service.js:471`) | Adds `remoteDelayedStageOf` |
| **Item 10: reminders** | **Half** | `remind` filters `pe.mode = 'visit'` (`:521`) and only knows the plan/thread turn | Adds six Remote moves + the overdue return |
| **Item 10: jobs** | **Ready** | nothing | Copies the `FOR UPDATE SKIP LOCKED` + compare-and-swap + notify-after-commit shape (`shootPlan.service.js:418-443`) |
| **Item 10: copy** | **Ready** | the keys | `productionCopy.js` |
| **Item 10: Needs You** | **Half** | both counts filter visit | Six new moves |
| **Existing parcel code** | **Broken** | `brandId` (§3.1) | Keeps the table; retires `dispatch`/`confirm-received`/`complete`/`drop` |
| **Item 5: selling scope** | **Ready** | a brand-facing picker endpoint | `ci.alloc_scope / alloc_category_node_id / alloc_category / alloc_product_ids` (`148…sql:61-68`); the live resolver is `follower.service.resolveAllocatedProductIds` (`:313-370`) — recursive category subtree, fixed list, whole store, all filtered by `is_active AND pushed_to_store`. **Pay for Content has no scope — confirmed**, and `allocation.model.js:64` returns "Not set yet" for it. Production: 2 of 8 signed rows have `alloc_scope` NULL |
| **Listing engine** | **Ready** | the variant path is untested — 0 variants live | Availability = `is_active = true AND pushed_to_store = true`. Variant model = `product_variants` (size, colour, sku, stock, price_override, is_active). **No stock moves** — item 11 never writes `stock` |
| **Item 2B: addresses** | **Ready** | nothing | Four parts; `ref_states` / `ref_cities` (170); her profile `influencers.city_id / state_id` (171); branches `brand_branches` (172); `ref_cities.lat/lng` (190) for the simulator |
| **Item 9: the wallet** | **Partial** | a non-escrow lock, a partial release, and **"owed"** | `brands.wallet_balance` is the available balance (`wallet.controller.js:65,81`); a debit is one `UPDATE` + one `wallet_transactions` row (`contractSign.service.js:126-150`); the shortfall pattern is `agreement.service.js:208-231`. **"Owed" exists nowhere** |
| **Item 7: signing** | **Ready, nothing to change** | — | Reads `contracts.terms_json->'returnTerms'->>'days'`, written at `agreementTerms.service.js:291-294` from `platform_settings.remote_return_days` |
| **Item 12: content** | **Ready** | — | Shoot done writes `pe.influencer_completed_at` and `status = 'completed'` — exactly what item 12 will read. No money moves |
| **Item 16: customer orders** | **Ready to receive** | — | The layer takes a `shipment` row, not a collaboration. `follower_orders.courier_name / tracking_number` (105) is the manual thing item 16 replaces |
| **Notifications** | **Ready** | the 17 keys | `notification.service.send` → `notifications` row + OneSignal push (+ optional MSG91 SMS). **Recommend `sendSms: false` throughout**, as item 10 does |
| **Admin website** | **Ready** | the Test parcels page | Settings page is data-driven; `requireCapability('settings')` exists; recommend a new `shipping` capability for R18 |
| **Existing production data** | **Read** | — | §2.3 |

---

## 6. The shipping layer

### 6.1 Where it lives

```
backend/src/services/shipping/
  index.js            provider(), the only export callers use
  contract.js         the interface + the event vocabulary, documented
  simulator.js        the live provider today
  shiprocket.js       written, switched off, no network call
  webhook.js          one handler, both providers, idempotent + order-tolerant
```

It knows **nothing** about collaborations, contracts or creators. Its inputs are addresses,
weights, boxes and a `shipments` row id. That is what lets item 16 call it for a customer order.

### 6.2 The interface

```js
checkCoverage({ pickupPincode, deliveryPincode })
  → { delivers: bool, returnPickup: bool, checkedAt: iso }
quote({ pickupPincode, deliveryPincode, weightKg, box, direction })
  → { amount: number, gstIncluded: true, currency: 'INR', breakdown?: {} }
registerPickup({ branchId, name, address, pincode, cityName, stateName, phone })
  → { providerPickupId }
book(shipment)   → { courierName, trackingNumber, providerRef, labelKey }
cancel(shipment) → { cancelled: true }
bookReturn(shipment, { pickupDay }) → { courierName, trackingNumber, providerRef }
label(shipment)  → { buffer, contentType: 'application/pdf' }
```

`provider(name)` resolves from `shipments.provider` on an existing shipment, and from
`env.SHIPPING_PROVIDER` when creating one. **A shipment's provider is written once and never
updated** — enforced by never putting it in an `UPDATE` and by a test (check 33).

### 6.3 The webhook and the event vocabulary

`POST /v1/webhooks/shipping/:provider`, mounted beside the Razorpay one so it inherits
`express.raw()` and the JSON skip (`webhook.routes.js:29`, `app.js`).

Seven INFLX events, whatever the provider calls them:
`collected · out_for_delivery · attempt_failed(reason) · delivered · returned_to_store ·
weight_charge(amount, reason) · cancelled`

```sql
CREATE TABLE shipment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  provider text NOT NULL,
  event text NOT NULL,
  provider_event_id text,          -- the provider's own id when it gives one
  dedupe_key text NOT NULL,        -- provider|tracking|event|occurred_at
  occurred_at timestamptz NOT NULL,
  payload jsonb NOT NULL,          -- the raw body, always
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_shipment_events_dedupe ON shipment_events (dedupe_key);
CREATE INDEX idx_shipment_events_shipment ON shipment_events (shipment_id, occurred_at);
```

- **Idempotent** — the unique index on `dedupe_key`; a duplicate insert is caught and the handler
  returns 200 having done nothing.
- **Order-tolerant** — the event row is always written; the *state* is applied only as a
  monotonic forward step. `out_for_delivery` arriving after `delivered` writes its row and moves
  nothing, because each timestamp is written with `COALESCE(col, $ts)` under a `WHERE col IS NULL`
  guard, exactly as item 10's auto-confirm does.
- **Authenticated** — simulator: the caller must be an admin session (R18 only). Shiprocket: an
  HMAC over the raw body against `SHIPROCKET_WEBHOOK_SECRET`. The signature format is one of the
  §14 unknowns.
- **Logged raw** — `payload jsonb`, always, before any parsing.

Every downstream effect (wallet, Needs You, Delayed, notifications) hangs off the **event
handler**, never off the simulator. That is what makes check 16 provable.

### 6.4 The simulator

| Rule | Implementation |
|---|---|
| Coverage | pincode ends `999` → `{delivers:false, returnPickup:false}`; ends `998` → `{delivers:true, returnPickup:false}`; else both true |
| Quote | base + per-kg + per-100km from `ref_cities.lat/lng` (`190_city_coordinates.sql`), haversine, rounded to the rupee, GST inside |
| Book | `TEST` + 10 digits; a one-page PDF via `pdf.service` headed **"TEST — NOT A REAL SHIPMENT"** |
| Events | **only** from R18, and **only** through `POST /v1/webhooks/shipping/simulator` |
| Isolation | `provider()` throws if a `simulator` shipment reaches the Shiprocket adapter or the reverse; `F19` refuses a non-simulator shipment with *"Test parcels only work with the simulator."* |
| Audit | every R18 press writes a `production_event_log` row with the admin's user id |

### 6.5 The Shiprocket adapter

Written from the public docs: `POST /v1/external/auth/login` (token, 10-day),
`/settings/company/addpickup`, `/courier/serviceability`, `/orders/create/adhoc`,
`/courier/assign/awb`, `/courier/generate/pickup`, `/courier/generate/label`,
`/orders/cancel`, `/orders/create/return`, tracking webhooks.

**Switched off** means: `index.js` refuses to return the adapter unless
`SHIPPING_PROVIDER === 'shiprocket'`, and the adapter's own HTTP client throws
`SHIPROCKET_DISABLED` when `SHIPROCKET_ENABLED !== 'true'`. A test asserts no `axios` call is
made (check 34).

**Environment variables (none exist today):**

```
SHIPPING_PROVIDER=simulator        # simulator | shiprocket
SHIPROCKET_ENABLED=false
SHIPROCKET_EMAIL=
SHIPROCKET_PASSWORD=
SHIPROCKET_BASE_URL=https://apiv2.shiprocket.in
SHIPROCKET_WEBHOOK_SECRET=
SHIPROCKET_CHANNEL_ID=
```

**Switching providers** is one Render env change plus a restart. Already-booked shipments keep
their own `provider` and keep going through the simulator; only new bookings change. That is the
safest cutover and it needs no migration.

### 6.6 What only the live account can answer — for the founder

1. Whether **one INFLX Shiprocket account may ship for many brands** — i.e. whether each brand's
   branch can be a separate pickup location on one account, and how many pickup locations the
   plan allows. This decides whether `registerPickup` is per-branch or per-brand.
2. The **webhook signature scheme** — header name, algorithm, and whether it signs the raw body.
3. **Return-pickup coverage in Guntur and Vijayawada** — the rules already flag that same-city
   riders are absent there (§32). If reverse pickup is unavailable, Q1 stops being an edge case.
4. Whether return (reverse) shipments are **quoted at booking time** at all, or only when raised.
   The whole return-lock design assumes a quotable return price at outbound booking.
5. Whether the **label PDF** is a durable URL or a short-lived one — decides whether we cache it
   in R2 (recommended either way).
6. The **declared value / invoice** requirement for sample goods (see §14).
7. How **weight-difference charges** are notified — webhook, or only a reconciliation statement.
   If the latter, the weight-charge lane becomes a manual admin action, not an event.

---

## 7. The money — every movement as ledger rows

**Today's shape.** `brands.wallet_balance numeric(12,2)` (`001_initial_schema.sql:135`) **is** the
available balance (`wallet.controller.js:65,81`). A lock is a **debit of that number** plus an
audit row; "reserved" is derived by summing `escrow_lock − escrow_release`
(`wallet.controller.js:66-78`). `wallet_tx_type` is an enum of seven:
`topup, escrow_lock, escrow_release, payout, refund, platform_fee, withdrawal`
(`001_initial_schema.sql:36-38`, `075_brand_withdrawals.sql:23`).

**Why courier money must not reuse `escrow_lock`.** `getWallet`'s "reserved" figure means *money
committed to creators*. A courier hold in that bucket would inflate it and would be released by an
`escrow_release`, which the tranche machinery also writes. Four new values instead:

```sql
ALTER TYPE wallet_tx_type ADD VALUE IF NOT EXISTS 'courier_charge';
ALTER TYPE wallet_tx_type ADD VALUE IF NOT EXISTS 'courier_lock';
ALTER TYPE wallet_tx_type ADD VALUE IF NOT EXISTS 'courier_lock_release';
ALTER TYPE wallet_tx_type ADD VALUE IF NOT EXISTS 'courier_refund';
```

`ALTER TYPE … ADD VALUE` is non-transactional — the runner splits on `@@SPLIT@@` exactly as
`075_brand_withdrawals.sql:25` does, and none of the new values is *used* in the same migration.

| D5 movement | Rows written | Balance |
|---|---|---|
| **Outbound at booking** | `courier_charge` debit ₹X, notes "Shipping to {creator} · {campaign}" | `wallet_balance − X` |
| **Return lock at booking** | `courier_lock` debit ₹R, notes "Return pickup locked for {n} items" | `wallet_balance − R` |
| Refused when short | no rows; `WALLET_INSUFFICIENT` 422 with `{required, available, shortfall}` — **one total (X + R)** | unchanged |
| **Cancel before collection** | `courier_refund` credit ₹X + `courier_lock_release` credit ₹R | `+ X + R` |
| **Return settled at pickup** | `courier_lock_release` credit ₹R, then `courier_charge` debit ₹A (the actual). Net back = R − A | `+ R − A` |
| **No Return left** (all Gift, or every Return marked missing by her) | `courier_lock_release` credit ₹R | `+ R` |
| **Return-to-store charge** | `courier_charge` debit ₹S, notes carry the courier's reason | `− S` |
| **Weight charge, balance sufficient** | `courier_charge` debit ₹W, notes carry the courier's reason and both weights | `− W` |
| **Weight charge, balance short** | **no wallet row**; a `brand_dues` row for ₹W | unchanged |
| **A due settled** | on the next credit: `courier_charge` debit ₹W + `brand_dues.settled_at` | `− W` |

`reserved_balance` in `getWallet` is left **exactly as it is** — its FILTERs match only
`escrow_lock` / `escrow_release`, so the new values pass through without disturbing it (the same
reasoning `075` used for `withdrawal`). The wallet history screen shows every courier row under
its own label; **recommend** a `courier` group so §11.2's "these charges appear in the Brand's
wallet history as courier charges" is literally true.

### 7.1 "Owed" — the proposal

Nothing like it exists. Recommend the smallest honest thing:

```sql
CREATE TABLE brand_dues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  reason text NOT NULL,                       -- 'weight_charge'
  source_kind text NOT NULL,                  -- 'shipment'
  source_id uuid,
  note text,                                  -- the courier's words
  created_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz,
  settled_tx_id uuid REFERENCES wallet_transactions(id)
);
CREATE INDEX idx_brand_dues_open ON brand_dues (brand_id) WHERE settled_at IS NULL;
```

Taken from the **next money in** — one hook in the top-up credit path, inside the same
transaction, settling oldest-first and only as far as the credit reaches. It **never** blocks the
creator and never blocks a shoot; it does show on the brand's wallet as "Owed from your last
parcel". Whether it should also block a *new booking* is **Q7**.

### 7.2 Proving nothing touches the locked fee

`contracts.locked_amount` is written in exactly one place — the brand's signature
(`contractSign.service.js:155-165`) — and reduced only by `escrow.processTrancheRelease`. Item 11
writes neither. Check 29 is a balances-and-ledger snapshot before and after a complete shoot with
a return: `contracts.locked_amount`, `escrow_entries`, `influencers.wallet_balance`,
`influencer_ledger` — all four **byte-identical** across the whole item.

---

## 8. Proposed migrations (additive)

Next free number is **191** (188 files, highest `190_city_coordinates.sql`).

**191_item11_remote.sql** — one migration, six parts, idempotent throughout.

```sql
-- 1. The Remote Shoot Plan, on item 10's table
ALTER TABLE production_events
  ADD COLUMN IF NOT EXISTS address_sent_at        timestamptz,
  ADD COLUMN IF NOT EXISTS address_corrected_at   timestamptz,
  ADD COLUMN IF NOT EXISTS ship_to_name           text,
  ADD COLUMN IF NOT EXISTS ship_to_phone          text,
  ADD COLUMN IF NOT EXISTS ship_to_street         text,
  ADD COLUMN IF NOT EXISTS ship_to_pincode        text,
  ADD COLUMN IF NOT EXISTS ship_to_state_id       smallint REFERENCES ref_states(id),
  ADD COLUMN IF NOT EXISTS ship_to_city_id        integer  REFERENCES ref_cities(id),
  ADD COLUMN IF NOT EXISTS ship_to_state_name     text,      -- as sent
  ADD COLUMN IF NOT EXISTS ship_to_city_name      text,      -- as sent
  ADD COLUMN IF NOT EXISTS ship_to_note           text,
  ADD COLUMN IF NOT EXISTS ship_to_sizes          text,
  ADD COLUMN IF NOT EXISTS coverage_delivers      boolean,
  ADD COLUMN IF NOT EXISTS coverage_return_pickup boolean,
  ADD COLUMN IF NOT EXISTS coverage_checked_at    timestamptz,
  ADD COLUMN IF NOT EXISTS difference_reported_at timestamptz,
  ADD COLUMN IF NOT EXISTS difference_reported_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS remote_reminder_sent_at timestamptz;
-- length CHECKs NOT VALID: note ≤ 200, sizes ≤ 100

-- 2. Delayed — widen the vocabulary (the CURRENT constraint would REJECT every Remote stage)
ALTER TABLE campaign_influencers DROP CONSTRAINT IF EXISTS ci_delayed_stage_known;
ALTER TABLE campaign_influencers ADD CONSTRAINT ci_delayed_stage_known
  CHECK (delayed_stage IS NULL OR delayed_stage IN
    ('plan_not_sent','time_not_agreed','not_attended','not_confirmed','content_not_live',
     'address_not_sent','not_booked','in_transit','not_checked','shoot_not_marked'));

-- 3. The shipment (collaboration-agnostic on purpose, for item 16)
CREATE TABLE IF NOT EXISTS shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_event_id uuid REFERENCES production_events(id) ON DELETE CASCADE,   -- NULL for item 16
  direction text NOT NULL CHECK (direction IN ('outbound','return')),
  provider text NOT NULL CHECK (provider IN ('simulator','shiprocket')),
  branch_id uuid REFERENCES brand_branches(id) ON DELETE SET NULL,
  from_name text, from_phone text, from_street text, from_pincode text,
  from_city_name text, from_state_name text,
  to_name text, to_phone text, to_street text, to_pincode text,
  to_city_name text, to_state_name text,
  box_preset text CHECK (box_preset IS NULL OR box_preset IN ('small','medium','large','other')),
  box_l_cm numeric(6,1), box_w_cm numeric(6,1), box_h_cm numeric(6,1),
  weight_kg numeric(6,3) CHECK (weight_kg IS NULL OR weight_kg > 0),
  quoted_amount numeric(10,2), charged_amount numeric(10,2),
  return_hold_amount numeric(10,2), return_hold_released numeric(10,2),
  courier_name text, tracking_number text, provider_ref text, label_key text,
  pickup_day date,
  booked_at timestamptz, cancelled_at timestamptz, collected_at timestamptz,
  out_for_delivery_at timestamptz, delivered_at timestamptz, returned_to_store_at timestamptz,
  last_attempt_failed_at timestamptz, attempt_failed_count int NOT NULL DEFAULT 0,
  rebooked_from_id uuid REFERENCES shipments(id) ON DELETE SET NULL,
  autoconfirm_days int, autoconfirm_due_at timestamptz, autoconfirmed_at timestamptz,
  confirmed_at timestamptz, confirmed_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- ONE live outbound parcel per collaboration (a cancelled one does not count)
CREATE UNIQUE INDEX IF NOT EXISTS uq_shipments_one_outbound
  ON shipments (production_event_id)
  WHERE direction = 'outbound' AND cancelled_at IS NULL AND production_event_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_shipments_one_return
  ON shipments (production_event_id)
  WHERE direction = 'return' AND cancelled_at IS NULL AND production_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shipments_event ON shipments (production_event_id, direction);
CREATE UNIQUE INDEX IF NOT EXISTS uq_shipments_tracking
  ON shipments (provider, tracking_number) WHERE tracking_number IS NOT NULL;   -- the webhook lookup
CREATE INDEX IF NOT EXISTS idx_shipments_autoconfirm
  ON shipments (autoconfirm_due_at)
  WHERE direction = 'return' AND autoconfirm_due_at IS NOT NULL
    AND autoconfirmed_at IS NULL AND confirmed_at IS NULL;                      -- J1's lane

-- 4. shipment_events (see §6.3)

-- 5. The lines
ALTER TABLE production_event_items
  ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES product_variants(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS variant_label_at_dispatch text,
  ADD COLUMN IF NOT EXISTS disposition text CHECK (disposition IS NULL OR disposition IN ('return','gift')),
  ADD COLUMN IF NOT EXISTS disposition_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS disposition_changed_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS returned_on_shipment_id uuid REFERENCES shipments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS return_status text,             -- received | missing | damaged
  ADD COLUMN IF NOT EXISTS return_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS return_auto_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reported_at timestamptz,
  ADD COLUMN IF NOT EXISTS reported_by uuid REFERENCES users(id);
-- The unique index today is (event, parcel_no, product_id). With variants the same product
-- in two sizes is two legitimate lines, so ADD a second partial index on
-- (event, parcel_no, product_id, variant_id) WHERE variant_id IS NOT NULL, and leave the old
-- one for variant-less lines.

-- 6. Dues + the admin number
CREATE TABLE IF NOT EXISTS brand_dues (…);   -- §7.1
INSERT INTO platform_settings (key, value, min_value, max_value, unit, label)
VALUES ('remote_return_autoconfirm_days', 7, 1, 30, 'days', 'Remote return auto-confirm')
ON CONFLICT (key) DO NOTHING;
```

Plus a **non-transactional preamble** (split on `@@SPLIT@@`, as `075` does) for the four
`wallet_tx_type` values.

**Dry-run checks** (`scripts/run-191.js --dry`):

```
SELECT count(*) FROM production_events;                          -- 12, unchanged
SELECT count(*) FROM production_event_items;                     -- 0, unchanged
SELECT count(*) FROM campaign_influencers WHERE delayed_at IS NOT NULL;   -- 0
SELECT count(*) FROM shipments;                                  -- 0 (new)
SELECT count(*) FROM shipment_events;                            -- 0 (new)
SELECT count(*) FROM brand_dues;                                 -- 0 (new)
SELECT key,value FROM platform_settings WHERE key='remote_return_autoconfirm_days';  -- 7
SELECT unnest(enum_range(NULL::wallet_tx_type));                 -- 11 values
SELECT count(*) FROM campaign_influencers
  WHERE delayed_stage IS NOT NULL AND delayed_stage NOT IN (…);  -- 0 (constraint safe)
```

**No backfill.** Nothing is dropped, nothing is rewritten, and every existing row stays valid.

---

## 9. Proposed endpoints

House naming: brand endpoints hang off `/campaigns/:id/sets/:sid/invitations/:ciId/…`, creator
endpoints off `/influencers/me/invitations/:ciId/…` (`item10.routes.js:26-41`). Item 11 mounts
`item11.routes.js` at `/` beside it. **Every one**: `authenticate` → `requireRole` →
`requireApproved` → `assertShootOpen` → mode check. Anything not yours is **404, never 403**
(`shootPlan.load` sets the precedent, `:65-72`).

| ID | Method + path | Body → Response | Errors |
|---|---|---|---|
| F1 | `GET …/shoot/remote` (brand) · `GET /influencers/me/invitations/:ciId/shoot/remote` (creator) | → `{ shoot: { invitationId, shootId, gate, aim, mode:'shipment', campaignName, setName, brand, creator, postingDate, daysToPosting, stage, stageLabel, address (brand: null until sent), coverage, parcel, lines[], tracking{steps,current}, return{dueDate,overdue,booked,lines[],autoConfirmDueAt}, money{available,quoted,hold,dues}, delayed, can{}, steps[] } }` | `NOT_SIGNED`, `NOT_FUNDED`, `WRONG_MODE_VISIT`, 404 |
| F2 | `POST /influencers/me/invitations/:ciId/shoot/remote/coverage` | `{ pincode }` → `{ delivers, returnPickup, checkedAt, message? }` | `PINCODE_INVALID` |
| F3 | `POST …/shoot/remote/address` (creator) | `{ name, phone, street, pincode, stateId, cityId, note?, sizes? }` → F1 | `ADDRESS_ALREADY_SENT`, `NOT_DELIVERABLE`, per-field 422 |
| F4 | `POST …/shoot/remote/address/correct` (creator) | same body → F1 | `CORRECTION_NOT_ALLOWED`, `CORRECTION_USED` |
| F5 | `GET …/shoot/remote/products?q=&cursor=` (brand) | → `{ scope:{kind,label}, products:[{id,name,image,price,variants:[{id,label,stock}]}], nextCursor }` | `ADDRESS_NOT_SENT` |
| F6 | `PUT …/shoot/remote/lines` (brand) | `{ lines:[{productId, variantId?, quantity, disposition}] }` → `{ lines, summary }` — **recommend keeping it separate from F8** so R5 saves as she types and F8 stays a single money call | `PRODUCT_OUT_OF_SCOPE`, `PRODUCT_UNAVAILABLE`, `NO_LINES`, `TOO_MANY_LINES`, `TOO_MANY_OF_VARIANT`, `LIST_LOCKED` |
| F7 | `POST …/shoot/remote/quote` (brand) | `{ branchId, boxPreset\|dims, weightKg }` → `{ outbound, returnHold, total, available, shortfall, enough, line }` | `BOX_REQUIRED`, `WEIGHT_REQUIRED`, `BRANCH_NO_ADDRESS` |
| F8 | `POST …/shoot/remote/book` (brand) | same body + `idempotencyKey` → F1 with `parcel` | `ALREADY_BOOKED`, `WALLET_INSUFFICIENT` (`{required, available, shortfall}`), `NO_LINES`, `NOT_DELIVERABLE` |
| F9 | `GET …/shoot/remote/label` (brand) | → `{ url, expiresIn }` — a signed R2 URL, opened with `Linking.openURL` | `NOT_BOOKED` |
| F10 | `POST …/shoot/remote/cancel` (brand) | → F1 | `ALREADY_COLLECTED`, `NOT_BOOKED` |
| F11 | `POST …/shoot/remote/rebook` (brand) | `{ branchId, box, weightKg }` → F1 | `REBOOK_NOT_ALLOWED`, `REBOOK_USED` |
| F12 | `POST …/shoot/remote/check` (creator) | `{ answers:[{lineId,status,note?}] }` → F1 | `NOT_DELIVERED`, `ALREADY_CHECKED`, `NOTE_TOO_LONG` |
| F13 | `POST …/shoot/remote/report` (brand) | `{ kind:'difference'\|'return', note? }` → F1 | `ALREADY_REPORTED` |
| F14 | `POST …/shoot/remote/done` (creator) | → F1 | `CHECK_FIRST`, `ALREADY_MARKED` |
| F15 | `POST …/shoot/remote/lines/:lineId/gift` (brand) | → F1 | `RETURN_ALREADY_BOOKED` |
| F16 | `POST …/shoot/remote/return/book` (creator) | `{ pickupDay }` → F1 | `SHOOT_NOT_DONE`, `NOTHING_TO_RETURN`, `PICKUP_DAY_PAST`, `RETURN_ALREADY_BOOKED` |
| F17 | `POST …/shoot/remote/return/confirm` (brand) | `{ answers:[{lineId,status}] }` → F1 | `RETURN_NOT_DELIVERED`, `ALREADY_CONFIRMED` |
| F18 | `POST /v1/webhooks/shipping/:provider` | raw body → 200 always (after logging) | 401 bad signature |
| F19 | `GET /admin/test-parcels` · `POST /admin/test-parcels/:shipmentId/events` | `{ event, reason?, amount? }` | `TEST_PARCEL_REAL_PROVIDER` |
| F20 | `PATCH /admin/platform-settings` | **exists** — `item6.routes.js:44` | — |

**Every write is compare-and-swap.** The house pattern is
`UPDATE … WHERE id = $1 AND <the timestamp> IS NULL RETURNING *` and a 422 when `rowCount === 0`
(`shootPlan.service.js:381-386`, `:404-410`). F8 additionally takes the brand wallet row
`FOR UPDATE` inside the transaction, as `contractSign.service.js:125` does.

### 9.1 Affected callers

| Caller | Change |
|---|---|
| `Packages/Mobile` brand + creator | New screens; `services/api.js` gains ~18 methods |
| `collabCounts.service.js`, `brandInbox.controller.js` | Remote moves in both counts |
| `invitationRows.service.js:237, 397` | `shoot` field currently requires `pe_shoot_mode === 'visit' && plan_sent_at` → add the Remote branch so her Active card routes to the Remote screen |
| `production.controller.js:150, 555` | Field whitelists |
| `Packages/brand-web` | R17 free; R18 new; the shipment panel retired |

---

## 10. The job lanes

### J1 — `remote-return-autoconfirm.job.js`, hourly at `:15`

`:15` is free (`:05` Delayed, `:20` handshake + settlement-retry, `:25` social, `:35` pitch,
`:40` set-expiry, `:45` auto-confirm, `:50` negotiation, `:55` reminders).

Selects `shipments WHERE direction='return' AND autoconfirm_due_at <= now() AND autoconfirmed_at
IS NULL AND confirmed_at IS NULL` — the partial index in §8 is exactly this predicate.

**Idempotent, three ways, all copied from `shootPlan.autoConfirmDue` (`:418-443`):**
1. the selection requires both `NULL`s;
2. the row is re-read `FOR UPDATE SKIP LOCKED` inside the transaction;
3. the write is a compare-and-swap — `UPDATE … WHERE id=$1 AND autoconfirmed_at IS NULL AND
   confirmed_at IS NULL`, and `rowCount === 0` means another worker had it.

The due date is read **only** from `shipments.autoconfirm_due_at`, stamped from
`remote_return_autoconfirm_days` at the moment the return is **delivered to the branch** — never
the live setting, so changing the number moves no promised date (check 27). It is **skipped**
when `pe.difference_reported_at` or any line has `reported_at` (§11.2: "unless the Brand has
reported an item"). The gate is asked; a closed gate is counted and skipped. Notifications go out
**after commit**, per shipment, once. Every run logs one `production_event_log` row.

### J2 — the two existing lanes, extended

**`collab-delayed.job.js` at `:05`** — drop the `= 'visit'` filter at
`shootPlan.service.js:471`; branch `delayedStageOf` by mode. Remote:

| Remote stage | `delayed_stage` |
|---|---|
| no `address_sent_at` | `address_not_sent` |
| address sent, no live outbound shipment | `not_booked` |
| booked, not delivered | `in_transit` |
| delivered, not all lines answered | `not_checked` |
| checked, no `influencer_completed_at` | `shoot_not_marked` |

Complete → not flagged. **The return lane never delays anything** — a return outstanding past the
posting date is *overdue*, not *delayed*, and the two are separate words on the screens.
Idempotency is unchanged: `delayed_at IS NULL` selects, `FOR UPDATE SKIP LOCKED` locks, the
`UPDATE … WHERE delayed_at IS NULL` swaps. Both sides told once, after commit.

**`shoot-reminders.job.js` at `:55`** — add a Remote arm. Six moves, plus the overdue return:

| Waiting on | Anchor | Stored on |
|---|---|---|
| creator: send address | `contracts.brand_signed_at` | `pe.remote_reminder_sent_at` |
| brand: pick + book | `pe.address_sent_at` | `pe.remote_reminder_sent_at` |
| creator: check | `shipment.delivered_at` | `pe.remote_reminder_sent_at` |
| creator: mark shoot done | last `answered_at` | `pe.remote_reminder_sent_at` |
| creator: book the return | `pe.influencer_completed_at` | `pe.remote_reminder_sent_at` |
| brand: confirm the return | return `delivered_at` | `pe.remote_reminder_sent_at` |
| creator: return overdue | the derived due date | `pe.remote_reminder_sent_at` |

One column, because only one move is ever open at a time on a Remote shoot — the flow is strictly
sequential. Same rules as item 10: **48 hours since the later of the anchor and the last
reminder**, **nothing after the posting date** (the Delayed flag takes over) — **except the
overdue return**, which by §11.2 keeps reminding her past the posting date and is therefore the
one exemption, and **nothing whose gate is closed**.

---

## 11. Frontend plan

### 11.1 Reused as-is

`GateCard10`, `StepLine10`, `TimeCard10` (the solid-ink live card → the tracking card),
`Row10`, `DelayedChip10`, `AmberBox10`, `WaitBox10`, `MoveBox10`, `GreenBox10`
(`components/shoot/bits10.js`); `Card7`, `StateBox7` (`components/agreement/bits7.js`);
`PrimaryButton`, `SecondaryButton`, `TextButton`, `DangerButton`
(`components/settings/primitives.js`); `Skeleton`, `LoadError`, `useToast`
(`components/settings/feedback.js`); `StateCityPicker`
(`components/settings/StateCityPicker.js:20`) — **item 2B's picker, reused verbatim for R3**;
`useRouteToast`; `settingsTokens` + `fonts`.

### 11.2 New components

`ReturnGiftSwitch11` · `QtyStepper11` (1–5) · `ProductPickRow11` · `BoxPreset11` ·
`MoneyCard11` · `TrackingSteps11` · `ThreeWayCheck11` (received / missing / damaged) ·
`AddressForm11` · `LockedAddressCard11` · sheets: `SendAddressSheet11` (R4a),
`BookSheet11`, `CancelBookingSheet11`, `ReturnToGiftSheet11` (R15a), `ReportSheet11`,
`ShootDoneSheet11`, `PickupDaySheet11` (R12) — every one honours `busy` (check 39).

### 11.3 Per screen

| Screen | App | File | Notes |
|---|---|---|---|
| R1 | Brand | `BrandRemoteScreen.js` | `GateCard10` + `StepLine10` verbatim; blue wait box; Pick products disabled |
| R2 | Creator | `CollabsScreen.js:78` + card | Needs the `shoot` field to cover Remote (§9.1) |
| R3, R4a, R4b | Creator | `RemoteAddressScreen.js` | `StateCityPicker` reused; counters 200 / 100; F2 on pincode blur |
| R5 | Brand | `BrandRemoteProductsScreen.js` | Locked address card, scope line, "n of 20" |
| R6, R6b, R7 | Brand | `BrandRemoteBookScreen.js` | Branch radios, box presets, `MoneyCard11`; R6b reuses item 9's Add-money route |
| R8 | Both | inside the two Remote screens | `TrackingSteps11` + the ink card |
| R9 | Creator | `RemoteCheckScreen.js` | `ThreeWayCheck11` |
| R10, R13, R14, R15a, R15b | Brand | `BrandRemoteScreen.js` | One screen, states by `stage` + `can`, as item 10 does |
| R11, R12, R16 | Creator | `RemoteShootScreen.js` | Same |
| R17 | Admin web | **no change** | The page renders whatever the API returns |
| R18 | Admin web | `app/admin/test-parcels/page.js` | New, plus a nav entry and two `adminApi` methods |

### 11.4 The PDF label — the answer

**OTA-safe. No new native module.** Checked the binary's dependency list
(`Packages/Mobile/package.json:17-35`): there is **no** `react-native-pdf`, `react-native-fs`,
`react-native-file-viewer`, `react-native-share` or document-picker — item 7's finding still
holds. But `react-native-webview@^13.8.7` **is** compiled in, and core `Linking` needs nothing.

The shipped precedent is exactly what R7 needs:

```js
Linking.openURL(url).catch(() => show('Could not open the document'));
// BrandAgreementScreen.js:111 · AgreementScreen.js:78
```

So **F9 returns a short-lived signed R2 URL and the phone opens it in the browser**, which hands
off to the device's PDF viewer and its own print/share. Identical to the contract PDF, already
in production. No fallback needed, and nothing to rebuild the APK for.

The only other new thing on the phone is the tracking-number mono font — `fonts` already carries
one (used for AWBs on the website; confirm the token exists in `theme/tokens` before R7).

---

## 12. What item 16 will reuse

Everything in §6, unchanged:

- `shipping/` — the interface, `provider()`, the simulator, the Shiprocket adapter.
- `shipments` — `production_event_id` is **nullable**; item 16 adds `follower_order_id` beside it
  and nothing else changes.
- `shipment_events` + the one webhook handler, with its idempotency and order-tolerance.
- The label pipeline (`pdf.service` → `storage.putBuffer` → `getPdfDownloadUrl`).
- The Test parcels page, for testing order shipping before the account is live.
- `brand_dues` and the courier `wallet_tx_type` values, for order-shipping adjustments.

What item 16 must **not** inherit: anything that reads `production_event_id`. The rule for Phase
2b is that `shipping/` must compile and pass its tests with **zero** imports from
`production*`, `contracts`, `campaign_*` — enforced by a lint rule or a grep in the test.

---

## 13. Test baseline and the tests to add

### 13.1 Baseline

`npx jest --runInBand --json --outputFile=baseline_item11.json` against `inflx_test` on
`localhost:5544`, 22 Sep 2026 07:35–07:59 IST, **before any change**. Harness reported
`migrations applied: 188/188`.

| | Suites | Tests | Passed | Failed |
|---|---|---|---|---|
| **Baseline, 22 Sep 2026** | 126 (74 pass / **52 fail**) | **1430** | **1198** | **232** |
| Item 10's recorded baseline, 18 Sep | — | 1330 | 1109 | 221 |

The 232 are the pre-existing debt (`project_test_suite_debt`: certify no-regression, never
green). Item 11 must add **no new failures**.

`compare.js` was **not in the repo** — item 10 used it from scratch space, so the one artefact
that proves "no new failures" did not survive the item that produced it. It is committed this
time as **`backend/scripts/compare-tests.js`**: it keys a test on `file :: fullName`, prints
new / gone / newly-failing / newly-passing / still-failing, and **exits 1 only on newly
failing** — a test that was already red stays reported and does not fail the gate.

Existing tests in item 11's ground:

| File | Covers |
|---|---|
| `backend/tests/stage4-parcel.test.js` (282 lines, 7 suites) | who may complete; receiving ≠ shooting; items picked not typed; a resend is a second parcel; her verdicts; drop-touches-allocation; an empty box cannot be dispatched. **Several assert behaviour item 11 retires** — expect drift in the "dispatch" and "drop" suites |
| `backend/tests/shoot-plan.test.js` (235 lines) | item 10's gate, stages, jobs |
| `backend/tests/admin-escrow.test.js`, `escrow-fee-tiers.test.js`, `cron-low-wallet.test.js` | the wallet's neighbours — must not move |

### 13.2 Tests to add

| Area | New tests |
|---|---|
| Gate + mode | the route-table loop (check 1); PfS on signatures (2); both mode refusals (3) |
| Address | prefill (4); 999 / 998 (5); lock + second send + profile change (6); **privacy: three endpoints × before-send / other-brand / brand-street-address** (7); correction rules (8) |
| Products | scope per aim + availability (9); 0 / 21 / 6-of-a-variant (10) |
| Money | quote + hold only when Return (11); shortfall then success (12); debit + lock + list lock + label (13); cancel (14); **two taps → one booking** (15); weight charge + owed (19); return settle + release (25); Return→Gift / Gift→Return / no-Return-left (26); **check 29 — the full before/after snapshot** |
| Delivery | every simulated event through the webhook (16); duplicate + out-of-order (17); back-to-store + one rebook (18) |
| Checking | before delivery, one check per line, notify (20); report once (21); done needs check, opens content, moves nothing (22) |
| Returns | due date in India time (23); the three refusals (24); brand confirm + J1 + stamped due immune to the setting (27); overdue (28) |
| Delayed / Needs You / reminders | (30) (31) (32) |
| Provider | provider recorded + cross-provider refused (33); **no network call while off** (34); admin-only + logged (35); TEST label + tracking (36) |
| Access | another brand / creator → 404 (37); loading / empty / error states (38); `busy` (39) |
| Handover | `addParcelItems` works for the owner, refused for anyone else (40) |

---

## 14. Questions for the founder

Each carries a recommendation. **Nothing is built until you answer.**

### The thirteen assumptions in §11 — all confirmed by the repo

Assumptions 1–13 hold against the code as it stands, with three caveats worth your eye:

- **(1) the gate** is item 10's, unchanged and mode-agnostic — ✅. But **the mode check in the
  Remote direction does not exist yet**; the message in §7 is new copy.
- **(5) products** — the scope resolver is ready, but **two of the eight signed collaborations in
  production have no `alloc_scope` at all**, and the picker would show them nothing. See Q3.
- **(7) every rupee is the brand's** — ✅ in design, but **every brand wallet in production is
  ₹0.00**, so nothing can be booked until you top one up. See Q8.

### Q1 — Return items to a pincode with no return pickup (the rules' open question)

**Recommendation: exactly as you described, and the code supports it cleanly.**
The brand is warned before it can set any line to Return (the warning text in §7). If it keeps
Return lines: **no return lock is taken**, **no pickup can be booked**, F16 is refused with
*"Couriers can't collect returns from {pincode}. Arrange it with {name} directly, then confirm
what comes back here."*, and the brand **still confirms receipt in the app** — so the due date,
overdue and auto-confirm all run exactly as normal.

This is genuinely simpler than the alternative, because `coverage_return_pickup = false` becomes a
single flag that switches off two things (the hold at F8, the booking at F16) and switches on one
sentence. The auto-confirm clock is the only wrinkle: it is normally stamped **at delivery to the
branch**, and here there is no return shipment to deliver. **Recommend** stamping it when the
brand first opens the return card after shoot done, and saying so on the screen.

### Q2 — The variant, when the product has none

Fashion needs sizes, but **there are 0 `product_variants` rows in production** and 48 products.
Today the brand cannot pick a size because no sizes exist.
**Recommendation:** `variant_id` is **nullable**. A product with active variants **requires** one;
a product with none is picked as itself, and R5's variant line reads the product's own name. The
"at most 5 of one size" rule then applies per `(product, variant)` pair, and per product where
there is no variant. This ships now and gets better the day you add sizes.
*Alternative rejected:* forcing variants would make the picker empty on day one.

### Q3 — A collaboration with no selling scope

Two signed collaborations have `alloc_scope` NULL. For Pay for Content that is correct (no scope,
whole catalogue). For **Pay for Sale or Hybrid** it means she may sell nothing, and the picker
would be empty.
**Recommendation:** the picker refuses with *"{Name}'s selling scope hasn't been set. Set it
before you send her products."* and names where to set it — rather than silently showing an empty
list. **Confirm** that is the behaviour you want, or whether a scope-less sale collaboration
should fall back to the whole catalogue (**not** recommended — it would widen her commission
silently).

### Q4 — Does an unpaid due block a new booking?

**Recommendation: no.** A due is recovered from the next money in and nothing else. Blocking would
turn a courier's weighing mistake into a stopped shoot, which is the opposite of §11.2's
"never blocks the Creator". But you may want it to block a *new* booking (not the current one).
Say which.

### Q5 — Is a cancelled parcel's slot reusable?

§11.2 says one outbound parcel per collaboration, and cancelling reopens the list.
**Recommendation:** the unique index ignores cancelled rows, so cancel → change the products →
book again is unlimited **before collection**, while the "book again once" limit applies only to
the **back-to-store** path, which is what the rules actually cap. Confirm.

### Q6 — Declared value on the label, and the invoice

The courier will want a declared value, and Indian e-way / transit rules generally expect a
delivery challan or proforma invoice to travel with goods.
**Recommendation:** declared value = the sum of `price_at_dispatch × quantity` (we already
snapshot it, `161…sql:46`). For the paperwork, **recommend INFLX generates a delivery challan PDF
marked "Sample goods — not for sale. Value for insurance only."** alongside the label, using the
existing `pdf.service`. **This needs your call and possibly your CA's**, because it touches GST
treatment of free samples.

### Q7 — A GST invoice from INFLX to the brand for courier charges

If INFLX books the courier on its own account and recharges the brand, that is a supply, and the
brand will want input credit.
**Recommendation:** out of scope for item 11's build, but **record the intent now** — add a
`gst_amount` column to `shipments` at migration time so the data exists when invoicing is built.
Free to add now, expensive to backfill later. **Confirm.**

### Q8 — Reconciling INFLX's aggregator balance against brand debits

Once the real account is live, INFLX pays Shiprocket from one wallet while charging eleven brands.
**Recommendation:** a nightly reconciliation report in Admin — INFLX's aggregator statement versus
`SUM(charged_amount)` per day, with the variance named. Not built in item 11; **flagged now so the
`shipments` row already carries `quoted_amount` and `charged_amount` separately**, which is what
makes the reconciliation possible at all.

### Q9 — Four branches have no street address

4 of 11 live branches have no `formatted_address` and no `pincode`. Those brands cannot book.
**Recommendation:** booking refuses with item 10's existing sentence
(`productionCopy.js:28`) — *"Add the street address to {branch} first. You can do that under
Branches and come straight back."* No new copy, no new screen.

### Q10 — Test data before the walk

Nothing can be walked end to end until: a brand wallet has money, at least one product has
variants, and at least one branch has a full address. **Recommendation:** you top up the Kanchi
Silks (practice) wallet and complete its main branch address; I add sizes to three products from
the app. All three are your calls to make, not mine, and **none of them happens without your
word.**

---

## Appendix — figures

```
Production census, 22 Sep 2026 (SELECT only)
  signed collaborations by set mode      : shipment 5 · visit 2 · NULL 1
  production_events by mode/status       : shipment/confirmed 6 · visit/completed 3
                                           visit/confirmed 2 · visit/proposed 1
  production_event_items                 : 0 rows, 0 events
  events with any shipment_* value       : 1  (Delhivery / DL8829174C, contract UNSIGNED)
  campaign_influencers.delivery_address  : 0 of 19
  physical_delivery = true               : 0
  collaborations flagged Delayed         : 0
  product_variants                       : 0
  brand_products                         : 48 total · 41 active · 48 pushed_to_store
  brand_branches                         : 11 rows · 11 mains · 4 with no address AND no pincode
  brand wallets                          : 11 brands · TOTAL ₹0.00
  alloc_scope on signed                  : store 5 · category 1 · NULL 2
  platform_settings                      : 9 keys, remote_return_days = 7
  next free migration                    : 191

The five signed Remote collaborations (all Kanchi Silks (practice))
  33d9f389…  Pay for Sale   locked 0.00       posts 23 Sep
  63d9b70d…  Pay for Content locked 12,960.00  posts 23 Sep
  32738ebd…  Pay for Content locked 10,800.00  posts 30 Sep
  79203cf3…  Hybrid          locked  4,000.00  posts 30 Sep
  30f22d68…  Hybrid          locked  8,500.00  posts 30 Sep
  55fd78ce…  (sixth shipment event — NEITHER signature; gate-closed, invisible)

Backend test baseline (inflx_test @ 5544, 22 Sep 2026, before any change)
  → backend/baseline_item11.json
  migrations applied                     : 188/188
  suites                                 : 126  (74 passed · 52 failed)
  tests                                  : 1430 (1198 passed · 232 failed · 0 pending)
```

---

**Phase 1 ends here. Nothing has been changed. Awaiting approval before Phase 2a.**
