The item 7 gap report is approved. Start building.

This is a good report. It found three live defects on the money path that matter more than anything item 7 adds, and it was right to say so plainly.

Proceed in this order — **the safety fixes come first, before any new feature**:

1. **Phase 2a — make the money path safe.** The guarded UPDATE on both signatures, the `rowCount` check, the unique index on `escrow_entries`, the exact-sum split helper, the `escrow_release` write. Nothing else until these are done and tested.
2. **Phase 2b — the agreement.** Migration 183, the snapshot, send, both signature paths with the cutoff, the Aim branch on the money, withdraw, decline, the expiry job, the standard terms, the document.
3. **Phase 3 — the screens.** Brand P1–P3, P9–P12, P14, P15; Creator P4–P8, P16; the admin terms page.
4. **Phase 4 — tests.** Then the **full end-to-end test pack across items 2–7**, which is the next piece of work after this item.

Follow, in this order:

- the rules doc **v1.20** (§9 and §3, both amended today);
- the locked mockups (**updated today**: see §2);
- the item 7 gap-check prompt;
- your gap report, as changed by this message.

If anything comes up that none of these cover, stop and ask me. Don't guess.

---

## 1. Answers to your 12 questions

**Q1 and Q2 are already answered by the rules doc, and you should read §3 before building.** It says, in the Revenue Model table: *"INFLX takes a percentage of the agreed Pay-for-Content campaign/creator amount, defined by Admin. It is charged once, to the Brand, when the funds are locked. The Creator receives the full agreed amount; the fee is never deducted from Creator payments. No campaign fee is charged on the fixed amount in a Hybrid collaboration."*

**Q1. A percentage, admin-controlled, Pay for Content only.** A new number beside item 6's platform settings — `campaign_fee_pct`, default **8%** so nothing changes commercially on the day it ships. Charged once, to the brand, at the moment the funds lock. Leave `platform_fee_pct` alone: it is the commerce fee and has its own job.

**Q2. The escrow tier fee must not be taken from a fee tranche.** You have found a genuine contradiction, and the rules doc settles it: the creator receives the full agreed amount. Today she doesn't — on a ₹10,000 fee she is credited ₹9,700 while the brand is debited ₹10,800.

- For **Pay for Content and Hybrid fee tranches**, no tier fee is deducted. The campaign fee is INFLX's whole take on that money.
- **Don't delete `escrow_fee_tiers` or its table.** Report every other place it is used and leave those alone.
- This is not only a revenue decision. The agreement is now an evidentiary document that prints "₹2,250 when you both sign". Paying her ₹2,182.50 would make our own document false. That is the argument that decides it.

**Q3. Keep the destructive decrement.** Your reasoning holds: every reader already agrees with it, and Phase 1 has no path that voids a signed agreement. One condition — **fix the missing `escrow_release` write** while you are in there, so `reserved_balance` comes back down instead of only ever growing. And write a one-paragraph note in the final summary saying exactly what will have to change when cancellation and disputes arrive, so the next person doesn't have to rediscover it.

**Q4. Yes, and first.** Two simultaneous countersignatures double-locking a brand and paying tranche 1 twice is the worst thing in this codebase, and item 7 doubles the traffic on that path. Do it as **Phase 2a, before anything else**, and prove it with a concurrent test. The Pay for Sale case you found — where nothing is locked at all, so no row anywhere is locked and the deliverables would be created twice — is the same bug wearing a different hat. Guard both.

**Q5. Seven days, and the config is wrong.** The rules say seven; production says thirty. Set `return_window_days` to **7** and print from the config, never from a constant. The mockup's "7-day return window" is then correct rather than coincidental. If thirty was a deliberate decision somebody made, stop and tell me before changing it.

**Q6. Yes, a platform sentence plus a fourth admin number.** `remote_return_days`, default **7**, and the brand pays the return shipping. It is now in the rules doc (§9) and belongs in the standard terms, printed in every Remote agreement.

**Q7. Native views, and `Linking.openURL` for Download.** Shipping over the air is worth more than a nicer viewer today. Two conditions: shorten the presigned link from an hour to **five minutes** and log every issue. We will revisit an in-app viewer when there is another reason to rebuild the APK — note it in the summary as a known limitation, not as done.

**Q8. Yes — nothing deletes a contract row, anywhere.** An agreement that once existed is a record, and P15 has to name its ending months later. Every path marks instead: `declined`, `withdrawn`, `expired`. That includes the two paths that delete today — invitation decline and item 6's move-answer. A draft that was never sent takes the ending its invitation took.

**Q9. Yes, and go one step further.** Switch off brand-web's **Approve & Send** with a message — "Agreements are sent from the Brand app" — exactly as item 4 did with the invite button and the branch editor. Two doors with different rules is how deals end up with a bonus nobody agreed to. Custom clauses and the bonus are in neither the rules nor the mockups and must never reach the phone.

- **Web signing stays**, because the server does the real money maths. But make the web's `contractLockAmount` display read **C4** instead of its own `fee × 1.08`, or it will show a different number from the phone for the same deal.

**Q10. Yes.** Pre-filled from `users.name`, editable, stored, and printed as "{Name}, for {Brand}" — the person, not the company.

**Q11. The signature timestamps win everywhere.** Stop reading `status === 'active'` as signed. The four seeded contracts then read as unsigned, which is the truth about them.

**Q12. Both confirmed.** Available balance is the wallet balance (Q3), and the PDF is produced only at completion — so remove the generate call at `approveContract`.

---

## 2. The mockups have been updated

The campaign fee arithmetic was illustrative and is now consistent at 8%. Everything else is unchanged. Use this version.

- **P9, P10, P11, P12:** the campaign fee line reads "INFLX campaign fee · 8% — ₹720", the total locked is ₹9,720, the shortfall is ₹3,720, and "still locked" is ₹7,470.
- **P13:** the campaign fee row reads "₹720 (8%), paid by the brand", and a fifth clause has been added: *"The creator receives the fee in full. The INFLX campaign fee is paid by the brand and is never deducted from a creator payment."*

**None of these numbers is a constant.** Every one is computed from the fee and the admin setting.

---

## 3. The rules doc has been updated

**v1.20** replaces v1.19. Two additions to §9, both from your report:

1. The creator receives the agreed amount in full; no platform charge of any kind is deducted from a creator payment on Pay for Content or Hybrid.
2. The Remote return window (admin-controlled, seven days by default) and that the brand pays the return shipping.

Plus one line saying the campaign fee percentage and the two return windows are set on the same admin screen as item 6's numbers, and stamped on each collaboration when its agreement is generated. §3 already said the rest.

---

## 4. Five more decisions

### 4.1 Close the production bypass

`POST /contracts/:id/production/initialise` and the auto-heal on `GET /contracts/:id/production` check party membership and **no status at all**. That means the shoot plan can be reached without a signed agreement — which makes the whole of item 7 optional. Gate both on **both signatures present**, and report what else calls them. While you are there, report `production.controller.js:559` filtering on `ci.status = 'live'`, which is not a value of the enum.

### 4.2 The stamped numbers are stamped, not read later

`campaign_fee_pct`, `return_window_days` and `remote_return_days` are copied into `terms_json` when the agreement is generated, exactly as item 6 stamps the round limit and the pool lifetime. A later admin change must never alter a document that has been signed — or one that has been sent.

### 4.3 `autoCreate` must stop being ambiguous

It returns `null` both when the contract already exists and when the invitation isn't found, and its three queries are not in a transaction. Item 7 depends on that draft existing. Make the two cases distinguishable and put the writes in one transaction. Small change, and it stops a silent failure from looking like success.

### 4.4 One shared split helper, used everywhere

The display already computes the exact-sum split correctly at `invitationRows.service.js:339`; the escrow writer does not. Extract the correct one, use it in both, and delete the wrong one. Prove it with an odd fee — ₹9,999 and ₹10,001 both.

### 4.5 The draft stays

Your recommendation is right: leave the draft `autoCreate` makes, and have "Send agreement" fill it in and stamp it. Snapshotting at accept would freeze terms that item 6 can still change.

---

## 5. Everything else in the report is approved as written

1. **Migration 183** exactly as proposed, including the three new statuses, the reference sequence, the `standard_terms` table seeded at version 1.0 with the seven sentences verbatim, and **the unique index on `escrow_entries (campaign_influencer_id, tranche_number)`**. Dry-run first and print every count you listed, including the duplicate check.
2. **`terms_json` written once, at send, guarded by `WHERE sent_at IS NULL`**, in the shape you set out. This is the item's spine — the document must read only from it.
3. **The cutoff** called in both signing paths through `campaignState.assertNotClosed`.
4. **The set-expiry job** extended to close unsigned agreements, assert nothing is locked, and name the half-signed case to her.
5. **The standard terms as their own table**, with the admin page at `/admin/settings/terms` beside item 6's, same capability, same audit line.
6. **The document** generated only at completion, from the snapshot alone, with `pdf_sha256`, the five-minute link, and the exclusions — no follower offer, no coupon, no street address.
7. **The signature record**: typed name, timestamp, device and IP on both sides, `trust proxy` already in place.
8. **The frontend plan** as listed, including the Creator app's Active tab, which has been waiting for this item.
9. **No backfill, and never invent a signature.** The seeded rows stay exactly as they are.

---

## 6. Please also

1. **Add these checks** to the 32 in the prompt:
   - **33.** Two simultaneous countersignatures produce one lock, one set of escrow entries and one tranche-1 release — proved with a real concurrent test, on both a Pay for Content and a **Pay for Sale** contract.
   - **34.** The three tranche amounts sum exactly to the fee for ₹9,999 and ₹10,001, in the escrow rows and on every screen.
   - **35.** A creator receives her tranche in full, with no tier fee deducted, on Pay for Content and on Hybrid.
   - **36.** Hybrid locks the fixed fee with no campaign fee; Pay for Content locks fee + campaign fee; Pay for Sale locks nothing.
   - **37.** `reserved_balance` goes back down as tranches release.
   - **38.** The shoot plan cannot be reached, by either bypass endpoint, without both signatures.
   - **39.** No path deletes a contract row: declining, withdrawing, expiring and item 6's move-answer all leave a row with its ending recorded.
   - **40.** Changing `campaign_fee_pct` or either return window afterwards does not alter a sent or signed agreement, and does apply to the next one.
   - **41.** brand-web's Approve & Send shows its new message, and its lock amount matches the phone for the same deal.
2. **Final summary** covering:
   - the money safety fixes, first, with the concurrent test result;
   - what INFLX now earns on a Pay for Content deal, stated as one worked example end to end;
   - migration 183 with before and after counts;
   - the snapshot, and proof the document cannot drift;
   - the standard terms and how an old version is served;
   - what is still owned by item 9, and the note from Q3 about cancellation;
   - the PDF-viewer limitation from Q7, stated as a limitation;
   - test results against your baseline of **229 failed / 982 passed / 1211**;
   - the result of every check, 1–41;
   - anything left open before the end-to-end test pack.
