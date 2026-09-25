The item 12 gap report is approved, with the changes in this message. Start building.

Three findings earned it. **Money can already leave for Pay for Content through a door nobody guards**: `/deliverables/:id/confirm-live` asks for no signature, no shoot, no Aim, and the brand website calls it — both production Pay for Content collaborations already have the rows it needs. **The final-payment wait is read live on every job run**, so changing the number would move a date already promised. And **you caught my own mistake**: the mockups split ₹12,960 — the fee plus the campaign fee — when the rules split the fee alone. Say all three plainly again in the final summary.

**The mockups are corrected and reissued** (`INFLX_Item12_Content_Mockups.html`, same file, fee split now ₹12,000 → 3,000 / 3,000 / 6,000, the campaign fee shown as its own line on the brand's card, "still locked" stated as her fee in escrow, and the rounds wording of Q8). Build to the reissued file.

Proceed in this order. **Nothing in Phase 2c starts until 2a and 2b are finished and proved:**

1. **Phase 2a — close the money door and the privacy holes.** Retire all eight `/deliverables` routes for every Aim; retire the Store Visit branch of `POST /production-events/:id/complete`; turn the brand website's review, confirm-live and inbox panels read-only; `assertContentOpen` on every content path; the file-privacy rules. Prove it with the gate matrix over every route before anything else is written.
2. **Phase 2b — storage and uploads**, in a commit of its own, proved with a real 200 MB video on a real phone: the presigned PUT with `Content-Length` signed, the streaming `{uri}` body, `headObject` verification, the mismatch delete, the sweep. If the streaming PUT does not survive on a device, stop and tell me before writing any screen.
3. **Phase 2c — the flow**: the package, the rounds, posting and proof, confirm live, the two releases, J1, the J2 arms, the Admin numbers, notifications, Needs You.
4. **Phase 3 — the screens**: Creator C1, C3–C5, C8, C10, C12, C15; Brand C2, C6, C7, C9, C11, C13, C14, C16; Admin C17.
5. **Phase 4 — tests**, checks 1–29 from the prompt plus 30–46 below, `compare-tests.js` against `baseline_item12.json`, governance check.

Follow, in this order: the rules doc **v1.29** (attached — it writes in the answers to Q1, Q6, Q7, Q9 and Q10); the **reissued** mockups C1–C17; the item 12 gap-check prompt; your gap report, as changed by this message.

If anything comes up that none of these cover, stop and ask me. Don't guess.

---

## 1. Answers to your questions

**Q1 — The rules win, and the mockups were wrong.** Her split is of her fee alone: ₹12,000 → 3,000 / 3,000 / 6,000. The brand's card carries one extra line, "INFLX campaign fee ₹960 · charged to you at signing, never to her." "Still locked" is computed from the escrow rows, never from `locked_amount − released_amount`. Both are in the reissued mockups.

**Q2 — Yes, and first.** All eight routes, every Aim, `RETIRED_12_*`, data kept. The brand website panel becomes one read-only card: "Content is reviewed and confirmed in the app."

**Q3 — Yes.** Retire the Store Visit branch in 2a; "Mark visit done" becomes the read-only card.

**Q4 — Yes, move it.** `final_payment_wait_days` (7, range 1–60) joins `platform_settings` with its audit, and is the only reader. The Payments page shows it read-only with a pointer to Platform settings. Migrate the current value across in 191's style, and say in the summary what `payment_config.tranche_3_release_after_days` now is: unread, left in place.

**Q5 — Yes.** The IST date of the confirmation plus N days, at the configured 03:00 IST release time, stamped on the tranche row. C12's date is then exact.

**Q6 — Yes, reminders continue past the posting date** for content, every 48 hours, until the move is made, reported or completed. It is the one place where items 10 and 11's "stop at the posting date" does not apply, because there is no later step to take over. Put the reason in a comment naming this decision.

**Q7 — Yes, refuse.** "This agreement lists no content. INFLX will sort it out." Never fall back to live formats. Tell me the count in production — you say it is zero; confirm after the migration.

**Q8 — Yes, your wording.** Exactly: "You have {n} rounds. After this one you can approve it or report it to INFLX." on the change sheet; "You've used both rounds." when the limit is 2, "You've used all {n} rounds." otherwise; the pill reads "ROUND {i} OF {n}", "· LAST" on the last, "ROUNDS USED" beyond it.

**Q9 — Yes, and go further.** The Delayed stage is updated silently as the collaboration moves, **across phases too**: a row flagged `address_not_sent` during the shoot shows `content_in_review` once that is where it stands. Both sides are still told only once, at the first flag.

**Q10 — Yes, with one addition.** A brand report (`rounds_used`, `posted_wrong`) freezes the step: every write returns `REPORTED_HOLD`, no money moves, her fee stays in escrow. Both sides see the same sentence saying INFLX has it and that nothing is lost. Her `brand_silent` report never blocks the brand confirming live. **Addition:** J1 skips any row whose collaboration carries a brand report, even though today's flow cannot produce one — defensive, and tested.

**Q11 — Yes.** Signed URL in the phone's own player for now. `react-native-video` goes on the next APK list, not in item 12's way.

**Q12 — Yes to the admin file URL now; no to `collab_reports`.** Record on `collab_content` plus a `collab_events` row, as item 11 did. Item 18 unifies them.

**Q13 — Yes.** Keep the manual release for item 18, but in item 12: an audit row with the admin's id and a **required** reason stored in the database, not the console, and a refusal on `disputed` and `refunded` rows.

**Q14 — Fix all four,** because item 12's own states expose them. The `escrow.created_at` read goes to its own task. **The campaign-cancel bug does not:** cancelling refunds only `locked` rows, so once item 12 queues a tranche 3, a cancel would still pay it. Item 12 adds a guard — a collaboration with a `queued` tranche cannot be cancelled that way, with a clear message — and the full fix stays a separate task.

**Q15–Q29 — confirmed as you state them,** with your refinements: the per-file note ≤ 300 characters; the count as the minimum per row; links `https` on the row's platform host (accept `instagram.com`, `www.instagram.com`, `youtube.com`, `www.youtube.com`, `youtu.be`, and `m.` variants), shape checked and never fetched; a Story screenshot is an image under the photo rules.

**Q30 — Nothing happens.** A deleted post before the final 50% changes nothing (§12.2).

**Q31 — Noted,** no backfill.

**Q32 — Yes,** create `features/item12-content/` at approval with the 29 checks plus the 17 below as `03-expected-outputs.md`, and the reissued mockups in `04-preview/`.

---

## 2. Things to fix or pin that the report left open

### 2.1 The sweep must never delete a submitted file

The 24-hour sweep of unconfirmed uploads runs while a package is in review. It deletes only rows with `verified_at IS NULL` **and** no reference from any `content_rounds.package_json`. Test it with a file uploaded, submitted and still unverified through a race.

### 2.2 Round history is part of the screens

C9 and C14 show what earlier rounds asked for. `G1` returns every round with its `submitted_at`, verdict, reason and file ids, to **both** sides. A creator can see what she was told, in her own words back.

### 2.3 Proof slots

One slot per unit of the count: a row of `reel × 2` has two link slots, a row of `story × 2` has two screenshot slots. "Posted" is refused until every slot on every row is filled.

### 2.4 Confirm-live is a money write

`G10` takes the collaboration's escrow rows `FOR UPDATE` inside its transaction, is idempotent on `live_confirmed_at IS NULL`, and refuses a collaboration that is cancelled, expired or already reported by the brand. Two taps, two devices and a retry after a timeout produce one release.

### 2.5 Her report tells both sides

A `brand_silent` report notifies the brand as well as recording it. It is not a secret escalation, and the brand can end it by confirming.

### 2.6 The screenshot is a file like any other

Story screenshots go through the same private storage, the same size and type checks and the same G12 serving rules. They are never public, and never `putBuffer`.

### 2.7 Name the freeze in one place

`REPORTED_HOLD` is one guard called by every write in the content service, not a check copied into each endpoint. One function, one message: "INFLX is looking at this. Nothing can change until they get back to you."

---

## 3. Everything else in the report is approved as written

1. **`assertContentOpen`** exactly as §5: the item 10/11 gate, then the Aim, then `production_events.status = 'completed'`, then ownership with 404. Never `shootPlan.stageOf`.
2. **`contentMoney.service.js`** as the single tranche door outside the brand's signature, calling `processTrancheRelease` unchanged, and used later by item 15.
3. **Migration 192** as drafted, plus `final_payment_wait_days` (Q4), the cancel guard (Q14) and the admin-release audit row (Q13). Idempotent, applied twice to the test database, money read before and after and identical.
4. **The five new `delayed_stage` values**, the silent stage update (Q9), and the third arm in the Delayed job.
5. **J1 by extending `tranche-3-release.job.js`** at `:00`, with the stamped due, `SKIP LOCKED`, completion inside the release transaction, notification after commit, no SMS, and the Q10 skip.
6. **J2b at `:55`** with `openContentMove` shared by Needs You and the reminders, and the upload sweep of 2.1.
7. **The endpoints G1–G13** with your shapes and codes, plus the round history of 2.2 and the slots of 2.3. Compare-and-swap everywhere.
8. **Storage** exactly as §6: signed `Content-Length`, `headObject` verification, delete on mismatch, 300-second signed GETs, admin only once reported, nothing through `putBuffer`, `brand_media_assets` or `/uploads`.
9. **The frontend plan** as §11, including `LoadErrorList`, the `busy` rule on every sheet, and the duplicate-screen-name test for both navigators.
10. **The retirements** in §4, with the legacy rows kept and unread, and `contracts.revision_limit` left alone.
11. **`contentCopy.js`** with the new `content.*` keys, no SMS, and copy word-for-word with the server.
12. **The baseline** as recorded, including your note that three item 3b tests went red from date drift with no code change — carry that note into the final summary so nobody blames item 12.
13. **The brand website and admin changes**, and C17 appearing by itself.

---

## 4. Please also

### 4.1 Extra final checks — add these to the 29 in the prompt

**Money**

30. Her fee alone is split; the campaign fee never appears in her card, never in her split, and never in a release.
31. "Still locked" is computed from escrow rows: ₹9,000 before the second payment, ₹6,000 after it, ₹0 once complete.
32. The legacy `confirm-live` route, and all seven others, refuse for every Aim — proved by a loop, with one case per Aim.
33. Changing `final_payment_wait_days` after a confirmation does not move a stamped due date; a new confirmation uses the new number.
34. A collaboration with a queued tranche cannot be cancelled through the campaign-cancel path, and says why.
35. The manual admin release refuses `disputed` and `refunded` rows and writes an audit row with a reason.
36. The four adjacent defects are fixed: no false low-wallet SMS, a queued tranche still counts as pending for her, "still locked" is right, and a notification failure never loses completion.

**The flow**

37. Round history is returned to both sides, with reasons, verdicts and file ids, for every round.
38. Every proof slot must be filled before "posted"; a row of two needs two.
39. A brand report freezes every write with one message; her `brand_silent` report does not, and the brand can still confirm and pay.
40. A `brand_silent` report notifies the brand.
41. The sweep deletes an unconfirmed orphan and never a file referenced by any round.
42. An agreement with no deliverable rows refuses the step with Q7's sentence.

**Delayed, reminders, storage**

43. A collaboration flagged Delayed at a shoot stage shows the current content stage afterwards, and is notified only once.
44. Content reminders continue past the posting date, every 48 hours, and stop on the move, a report or completion.
45. A 200 MB MP4 uploads from a real phone, is verified by `headObject`, and a file whose real size or type differs from what was declared is deleted and refused.
46. A story screenshot obeys the photo rules and is served only through G12.

### 4.2 Final summary — cover, in this order

- **The three findings** at the top of this message, and what each now does.
- **The money:** every path that can release a tranche, before and after; proof that only two releases happen in item 12 and that nothing is deducted; the before-and-after snapshot of check 21.
- **What was retired**, in order — the eight `/deliverables` routes, the Store Visit `complete` branch, the website panels, the legacy notification keys, the orphaned phone helpers.
- **Storage:** the upload path as built, and the device result for a 200 MB video, stated plainly.
- **The Admin numbers**, where each now lives and what stamps it.
- **Test results** against `baseline_item12.json`, with `compare-tests.js`, the retired `deliverables` describe blocks, and the item 3b date-drift note.
- **The result of every check, 1–46.**
- **Handover notes:** `react-native-video` for the next APK, the `escrow.created_at` read, the full campaign-cancel refund fix, and what items 14 and 15 inherit.

Nothing is submitted, approved, rejected, confirmed, reported or completed in production, and no money moves, without asking me first.
