The item 11 gap report is approved, with the changes in this message. Start building.

Four findings earned it: **`addParcelItems` has never been able to work**, because `getContractParties` never selects `b.id`; **three live endpoints can leak a creator's address the moment one exists** — `getProduction` returns the whole row to either party, `listCampaignProduction` treats the gate as a column rather than a filter, and `influencer.controller.js:1531` returns `ci.delivery_address`; **the Delayed CHECK would have thrown on the first Remote stage**; and **every brand wallet in production is ₹0.00**, so nothing could have been booked on the first day of testing. Say all four plainly again in the final summary.

Proceed in this order. **Nothing in Phase 2c starts until 2a and 2b are finished and proved:**

1. **Phase 2a — fixes, privacy, retirements.** The `brandId` fix; the field whitelists on `getProduction` and `listCampaignProduction` and the removal of `ci.delivery_address` from `influencer.controller.js:1531` and `ProductionSection.js:29`; the `delivery_address` prefill block in `production.service.js:210-233`; the mirror mode check (`WRONG_MODE_VISIT`) on every Remote path; the retirements in §3.3 below. Prove it with the route-table loop before anything else is written.
2. **Phase 2b — the shipping layer**, in a commit of its own: `backend/src/services/shipping/` (interface, `provider()`, simulator, Shiprocket adapter switched off, webhook), `shipments`, `shipment_events`, `brand_branch_pickups` (§2.8), the courier `wallet_tx_type` values, `brand_dues`, the R18 page. Test the layer on its own — including the zero-imports rule — before any feature uses it.
3. **Phase 2c — the Remote flow**: address and coverage, products, lines, quote, book, label, cancel, rebook, check, report, shoot done, Return → Gift, the return, the brand's confirm, J1, the J2 extensions, the Admin number, notifications, Needs You.
4. **Phase 3 — the screens:** Brand R1, R5–R7, R10, R13–R15b; Creator R2–R4b, R8, R9, R11, R12, R16; Admin R17 (no change), R18.
5. **Phase 4 — tests**, checks 1–41 from the prompt plus 42–60 below, `compare.js` against `baseline_item11.json`, governance check.

Follow, in this order:

- the rules doc **v1.27** (§11.2 — v1.27 is attached and writes in the answers to Q1, Q3, Q4 and Q5, and the two money rules in §2.2 and §2.3 below);
- the locked mockups **R1–R18**;
- the item 11 gap-check prompt;
- your gap report, as changed by this message.

If anything comes up that none of these cover, stop and ask me. Don't guess.

**Before 2a:** finish the baseline run and put the real figures in `baseline_item11.json`. The report says "figures pending"; nothing is compared against a baseline that was never written.

---

## 1. Answers to your ten questions

**Q1 — Yes to "sort it out between them", but not your auto-confirm clock.** Stamping the clock "when the brand first opens the return card" makes the creator's protection depend on the brand opening a screen. A brand that never looks would leave her with a return that is overdue forever. Instead:

- When `coverage_return_pickup = false` and the brand keeps Return lines, **no return lock is taken** at F8 and F16 is replaced by a creator action, **"I've sent it back"** (new endpoint `POST …/shoot/remote/return/sent`), with an optional free-text note of at most 200 characters for how she sent it. It is allowed from shoot done, once.
- Her mark stamps `autoconfirm_days` and `autoconfirm_due_at` on a return `shipments` row with `provider = 'none'` (add that value to the CHECK) and no courier fields. J1 then treats it exactly like any other return: the brand confirms each line, or it confirms itself at the stamped due, unless the brand has reported.
- She is told on R12's place: "Couriers can't collect from {pincode}. Send it back to {Brand} yourself — they cover the cost — then tap I've sent it back." The brand pays her back outside INFLX; INFLX moves no money for this return. Say so on the brand's warning at R5: "Couriers can't collect returns from {pincode}. If you mark this Return, {name} sends it back herself and you cover the cost directly."
- Overdue still counts from the same due date, until she marks it sent.

**Q2 — Yes, `variant_id` nullable.** A product with active variants requires one; a product with none is picked as itself. "At most 5" applies per `(product, variant)`, and per product where there is no variant. `variant_label_at_dispatch` is snapshotted either way.

**Q3 — Yes, refuse; never fall back to the catalogue.** For Pay for Sale and Hybrid with no scope, F5 returns 422 `SCOPE_NOT_SET`: "{Name}'s selling scope hasn't been set, so there's nothing you can send her yet." Tell me which two collaborations these are in the final summary. Do not set a scope on them — it was agreed at signing and is not item 11's to write.

**Q4 — No, a due never blocks anything,** including a new booking. It is taken from the next money in and shown on the brand's wallet as "Owed from a parcel — ₹{n}". "Next money in" means **every** credit to `brands.wallet_balance`, not only top-ups: top-up, sales settlement, escrow refund, courier refund, courier lock release. List every credit path you hook in the final summary, and prove with a test that a credit on each one settles an open due oldest-first, only as far as it reaches, in the same transaction.

**Q5 — Yes.** Cancel before collection is unlimited and reopens the list. "Book again once" applies only after a back-to-store.

**Q6 — Declared value, yes; the challan, not yet.** Declared value = `SUM(price_at_dispatch × quantity)`, sent to the provider and printed on the simulator label. **Do not generate a delivery challan in item 11.** Keep a nullable `challan_key` on `shipments` so it can be added without a migration once my CA answers. Put it in the handover notes as open.

**Q7 — Yes, add `gst_amount` to `shipments` now.** No invoicing is built. The simulator fills it with 18% of the charge, inside the total.

**Q8 — Agreed, not built.** `quoted_amount` and `charged_amount` stay separate. Put the nightly reconciliation into the handover notes for the go-live item.

**Q9 — Yes, item 10's sentence.** On R6 the branch radio also marks each unusable branch "Needs a street address and pincode" and cannot be selected, so the refusal is prevented rather than only answered.

**Q10 — I will do the money and the branch myself.** I'll top up the Kanchi Silks (practice) wallet and complete its main branch address before the walk. You may add sizes to three Kanchi Silks (practice) products, **after showing me which three and the sizes**, and to no other brand. Nothing else in production is written by you.

**Assumptions 1–13:** confirmed as you state them, with your three caveats.

---

## 2. Things the report got wrong or left open — fix them

### 2.1 `shipments.production_event_id` must not cascade

A shipment carries money: the wallet rows name it, `brand_dues.source_id` points at it, and the reconciliation in Q8 needs every one. `ON DELETE CASCADE` would let deleting a production event silently remove financial records. Use **`ON DELETE RESTRICT`**, and the same on `shipment_events.shipment_id`. Nothing in item 11 deletes a production event anyway.

### 2.2 The return costs more than the lock

§7's table settles a return as "release R, charge A", and never says what happens when A is greater than R. **Rule (now in v1.27):** release R, charge A; when A > R, the difference is charged from available balance, and if that is short it becomes a `brand_dues` row. **Never** refuse or delay her return pickup because of it. Test it.

### 2.3 A provider that can't quote a return at booking

Unknown 4 in §6.6 could break the whole return-lock design. **Rule (now in v1.27):** the lock is the provider's return quote when it gives one, otherwise **the outbound price for the same box and weight**. The settle rule in 2.2 covers any difference. The simulator must quote returns, so the normal path is tested, but add a simulator switch that refuses to quote a return, so this fallback is tested too.

### 2.4 Rebooking after a back-to-store

The report doesn't say what rebooking touches. Rules:

- The **list stays locked** and the same lines go. There is no changing products on a rebook.
- The rebook is a new outbound `shipments` row with `rebooked_from_id`; it **charges a new outbound price**; the **return lock from the first booking is kept**, not taken twice.
- Coverage is checked again against her address as it now stands (after her one correction, if she made one). If it no longer delivers, the rebook is refused with the not-deliverable sentence.
- The lines' earlier check state, if any, is cleared, and the clear is logged.

### 2.5 Pickup locations per branch

Unknown 1 decides whether pickups are per branch or per brand. Don't wait for it. Add **`brand_branch_pickups (branch_id, provider, provider_pickup_id, registered_at, address_hash)`**, unique on `(branch_id, provider)`. `registerPickup` is called at the first booking from a branch and again whenever the branch's address changes (`address_hash` differs). The simulator registers trivially. That works whichever way Shiprocket answers.

### 2.6 The reminder lane's one column

`pe.remote_reminder_sent_at` is right only because the flow is sequential. Make that explicit in code: when the open move changes, the anchor changes, and "48 hours since the later of the anchor and the last reminder" handles it. Add a test in which the move changes 10 hours after a reminder, and the next reminder waits 48 hours from the new anchor, not from the old reminder. The overdue-return exemption from the posting-date stop is right; name it in a comment citing §11.2.

### 2.7 F13 reports three things, not two

Report kinds: `difference` (R10), `return` (R13, missing or damaged on arrival), and `overdue` (R15b, "Report it to INFLX if you need to"). Each is recorded once per kind. The overdue report is refused before the due date passes.

### 2.8 The brand's "It's fine, carry on"

R10's quiet button dismisses the difference box for the brand. Record it (`pe.difference_acknowledged_at`) so the box stays dismissed across devices. It changes nothing else and is not a report.

### 2.9 `complete` and `accept` retirement — check the visit side first

`POST /production-events/:id/complete` and the shipment halves of `accept` / `counter-propose` are marked "any mode". Before retiring them, list every caller in the mobile app, the brand website and the admin website, and prove none is on item 10's Store Visit path. If one is, retire only the shipment branch and say so.

---

## 3. Everything else in the report is approved as written

1. **The fix** at `production.controller.js:46-63` — `b.id AS brand_id` — plus `ensureParty`.
2. **Privacy** — the field whitelists on `getProduction` and `listCampaignProduction` land **before** any `ship_to_*` column exists. The brand never receives `ship_to_*` before `address_sent_at`; the creator never receives `from_street` / `from_pincode` or any branch street address.
3. **Retirements, server-side, not by hiding buttons:** `dispatch`, `confirm-received`, `complete` (after 2.9), `items/:itemId/drop`, the shipment halves of `accept` / `counter-propose`, `production-shipment-reminder.job.js` and its SMS, the admin production-queue page, the brand website's shipment panel (read-only card: "Parcels are managed in the app."), the `delivery_address` prefill, and the `ci.delivery_address` reads. Leave the columns and data in place. `flip-to-remote` and `/initialise` stay refused.
4. **Migration 191** as written, with the changes in §2: `RESTRICT`, `provider` gains `'none'`, `gst_amount`, `challan_key`, `pe.difference_acknowledged_at`, `brand_branch_pickups`. The non-transactional preamble for the four `wallet_tx_type` values, split as `075` does. Dry-run and print every count you listed.
5. **The shipping layer** exactly as §6: the interface, `provider()` from the shipment on existing rows and from `SHIPPING_PROVIDER` on new ones, provider written once, the webhook beside Razorpay's with raw body, `dedupe_key` idempotency, monotonic `COALESCE … WHERE col IS NULL` state, raw payload always logged, **zero imports** from `production*`, `contracts`, `campaign_*` enforced in a test.
6. **The simulator** as §6.4, events only from R18, through the webhook handler, every press logged. Plus the "refuse to quote a return" switch from 2.3.
7. **The Shiprocket adapter** written and switched off twice (`SHIPPING_PROVIDER` and `SHIPROCKET_ENABLED`), with a test that no HTTP call is made. Env vars as listed; none of them is set on Render by you.
8. **The money** as §7 — four new `wallet_tx_type` values, never `escrow_lock`; `getWallet`'s reserved figure untouched; a `courier` group in the wallet history; `brand_dues` as §7.1 with the rule in Q4.
9. **The endpoints F1–F20** with your shapes and error codes, plus `return/sent` (Q1). Every one: `authenticate` → `requireRole` → `requireApproved` → `assertShootOpen` → mode check; 404 for anything not yours; compare-and-swap on every write; F8 takes the wallet row `FOR UPDATE`; F8 honours `idempotencyKey`.
10. **J1 at `:15`** and the **J2 extensions** at `:05` and `:55` as §10, with 2.6.
11. **The stages and the widened `delayed_stage` CHECK** exactly as listed.
12. **Needs You** — six moves, one rule, both sides; `invitationRows.service.js` routes her Active card to the Remote screen.
13. **17 notification keys**, `sendSms: false` throughout.
14. **The frontend plan** as §11 — the item 10 components reused, `StateCityPicker` verbatim, the new components, every sheet honours `busy`. **The label opens through `Linking.openURL(signedUrl)`**, as the Agreement PDF does. No new native module.
15. **R17 needs no code; R18** is new, behind a new `shipping` capability.
16. **`features/item11-remote/`** as the spec folder.
17. **`compare-tests.js`** committed under `backend/scripts/`.
18. **No backfill.** The five Kanchi Silks Remote collaborations read "Waiting for her address". The unsigned sixth stays invisible and untouched.
19. **The `stage4-parcel.test.js` drift:** list every assertion that fails because of a retirement, with the retirement that caused it, and move each into a `retired` block with a comment naming this item. None may be deleted silently.

---

## 4. Please also

### 4.1 Extra final checks — add these to the 41 in the prompt

**Privacy**

42. Before she sends her address, `getProduction`, `listCampaignProduction`, F1 and `influencer.controller.js`'s collaboration read return no `ship_to_*` or `delivery_address` to the brand; after, only the owning brand receives them; no creator payload ever contains a branch street address or pincode.
43. The `delivery_address` prefill no longer runs at the brand's signature.

**Money**

44. A return that costs more than its lock charges the difference; when the balance is short it becomes a due; her pickup is never refused or delayed.
45. With the simulator refusing to quote returns, the lock equals the outbound price, and settling works the same.
46. A rebook charges a new outbound price and does not take the return lock twice.
47. A due is settled by a credit on each credit path you hooked, oldest-first, only as far as the credit reaches, in the same transaction — and never blocks a booking.
48. `gst_amount` is filled on every simulated charge; `quoted_amount` and `charged_amount` are recorded separately.
49. Deleting a production event with a shipment is refused by the database.

**The flow**

50. A 998 pincode with Return lines: no lock taken, no pickup offered, "I've sent it back" stamps the auto-confirm clock, J1 confirms at the stamped due, overdue stops once she marks it sent.
51. A 999 pincode on a rebook after an address correction is refused with the not-deliverable sentence.
52. A rebook keeps the same locked lines and clears and logs any earlier check.
53. `SCOPE_NOT_SET` for Pay for Sale and Hybrid without a scope; Pay for Content always sees the published catalogue.
54. A product with variants cannot be added without one; a product without is added as itself; "at most 5" counts per `(product, variant)`.
55. Report kinds `difference`, `return` and `overdue` each record once; `overdue` is refused before the due date.
56. "It's fine, carry on" is recorded and survives a second device; it changes nothing else.
57. A branch without a street address and pincode cannot be selected on R6 and is refused by F7 and F8 with item 10's sentence.
58. `brand_branch_pickups` registers once per branch per provider and again when the branch's address changes.

**Reminders and retirements**

59. A reminder after a move change waits 48 hours from the new anchor.
60. Every retired endpoint and job refuses or no longer runs, proved by the route-table loop; no Store Visit caller was touched (2.9).

### 4.2 Final summary — cover, in this order

- **The four findings** at the top of this message, and what each now does.
- **Privacy:** every endpoint that can return a creator's address, before and after.
- **What was retired**, in order, and what replaced each — `dispatch`, `confirm-received`, `complete`, `drop`, the shipment halves of `accept` / `counter-propose`, the shipment reminder job and its SMS, the production queue page, the website shipment panel, the `delivery_address` prefill.
- **The shipping layer:** the interface, the simulator, the adapter and how it is kept switched off, the webhook and its idempotency, the zero-imports proof, and the list of what only the live account can answer.
- **The money:** every movement as it was actually written, the credit paths hooked for dues, and the before-and-after snapshot of check 29.
- **The two Pay for Sale / Hybrid collaborations with no scope,** by id.
- **Test results** against `baseline_item11.json` with the real baseline figures, `compare-tests.js` proving no new failures, the `stage4-parcel` drift list, and the new count.
- **The result of every check, 1–60.**
- **Handover notes:** the delivery challan (Q6), GST invoicing of courier charges (Q7), the nightly reconciliation (Q8), and each unknown in §6.6 — for the go-live item and for item 16.

Nothing is created, booked, cancelled, confirmed or marked in production, no call is made to any real courier, no environment variable is set on Render, and no money moves, without asking me first.
