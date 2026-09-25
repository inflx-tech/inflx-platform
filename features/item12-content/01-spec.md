# item12-content — spec

Rules doc **v1.29** §12.2 (with §3, §7A, §9, §10, §11, §11.1, §11.2, §19, §21, §22, §24, §25,
§26, §27, §28, §31). Locked mockups `04-preview/mockups/item12-content-locked.html` (C1–C17 plus
the rules table, **the reissued file**: her fee alone is split, ₹12,000 → 3,000 / 3,000 / 6,000; the
campaign fee its own line on the brand's card; "still locked" = her fee in escrow; the Q8 rounds
wording). Gap report `Docs/ITEM12_CONTENT_GAP_REPORT.md`, approved with the answers and pins in
`PROMPT.md`; the Phase 1 brief is `GAP_CHECK_PROMPT.md`.

v1.29 changed nothing of v1.28. It writes the answers to Q1, Q6, Q7, Q9 and Q10 into §12.2 as prose.

**Builds on** `features/item10-store-visit` and `features/item11-remote` (the gate, the shoot row,
the Delayed flag, the reminder lane, the copy module, the notify wrapper, the components) and on
item 9's money (`escrow.service.processTrancheRelease`, unchanged). **Retires** the pre-rebuild
content flow (`/v1/deliverables/*`, eight routes) and the Store Visit branch of
`POST /production-events/:id/complete`.

## What item 12 delivers

After a completed shoot, a Pay for Content creator **uploads the content she agreed to** as one
complete package; the brand **approves it or asks for changes** within an Admin-controlled number
of rounds stamped at her first submission; she **posts it and proves it** (a link per deliverable,
a screenshot per Story); the brand **confirms it is live**, which releases the **second 25% of her
fee** and stamps the waiting period; a job releases the **final 50%** at the stamped date and the
collaboration is **Completed**.

It is the first item where a creator's work is judged, the first to hold creator media, and the
first since item 9 to move money to a creator. **Items 14 and 15 reuse it.**

## The three findings that earned the approval

1. **Money could leave for Pay for Content through a door nobody guarded.**
   `POST /v1/deliverables/:id/confirm-live` asked for no signature, no shoot, no Aim; the brand
   website called it; both production Pay for Content collaborations already had the rows it
   needed.
2. **The final-payment wait was read live on every job run**, so changing the number would move a
   date already promised.
3. **The mockups split ₹12,960 — the fee plus the campaign fee — when the rules split the fee alone.**

## The rules, as built

### The gate (§10, §11, §12.2)
`contentGate.assertContentOpen(ciId, scope)` on **every** content path, reads and writes:
1. the item 10/11 gate (`shootGate`): signed by both, funded, tranche 1 released;
2. the Aim: `campaign_sets.goal = 'engagement'` (Pay for Content) — else **404**;
3. `production_events.status = 'completed'` — else `SHOOT_NOT_DONE` (G1 draws it instead);
4. ownership — the owning brand through its own campaign and set, that creator; else **404**.
Never `shootPlan.stageOf`. An agreement snapshot with no rows refuses the step (Q7).

### What she owes (§7A, §22)
`contracts.terms_json.work.deliverables` — rows of `{type, count}`, fixed at signing. Row key =
the type (unique per agreement, §7A). The platform comes from the type: reel / post / story →
Instagram; youtube_video / youtube_short → YouTube. `story` rows are proved by screenshot. **Never**
the live `formats_json`, **never** the legacy `deliverables` rows.

### The package (§12.2)
Photos JPG/PNG ≤ 10 MB, videos MP4 ≤ 200 MB, ≤ 10 files a row, at least the row's count to send;
a caption per row ≤ 500, optional. Free to change until sent; **one complete package or nothing**;
submitting locks it.

### The review and the rounds
One verdict on the package: approve, or ask for changes with a required reason ≤ 500 and optional
per-file notes ≤ 300. Rounds = `content_change_rounds` (2 by default, 1–5), **stamped at her first
submission**. The pill reads "ROUND {i} OF {n}", "· LAST" on the last, "ROUNDS USED" beyond it. Beyond
the rounds: approve or report — a further change request is refused by the server. Every round is
kept, frozen, and returned to **both** sides.

### Posting and proof
Approval locks the content. One proof slot per unit of the count: a link (`https`, the row's
platform host — `instagram.com`, `www.`/`m.` variants; `youtube.com`, `www.`/`m.` variants,
`youtu.be`; shape only, never fetched) or, for a Story, a screenshot under the photo rules. She
confirms she posted only when every slot on every row is filled; that stamps
`content_report_silence_days` (7, 1–30).

### Confirming live and the money (§3, §12.2, §19, §25)
The brand confirms live → **the second 25% of her fee** is released through
`contentMoney.releaseSecond` (item 9's `processTrancheRelease`, unchanged) and tranche 3 is queued
with `release_due_at` = the IST date of the confirmation + `final_payment_wait_days` (7, 1–60), at
the configured 03:00 IST release time. **No auto-confirm.** The tranche-3 job releases the final
50% at the stamped due and completes the collaboration **inside the same transaction**. Nothing is
deducted; the campaign fee is never in her split. "Still locked" is computed from escrow rows.
Item 12 moves those two payments and nothing else.

### Reports (§26) — recorded, handled in item 18
Brand: `rounds_used`, `posted_wrong` → **freeze**: every write answers `REPORTED_HOLD` — "INFLX is
looking at this. Nothing can change until they get back to you." — one guard in the content
service. Creator: `brand_silent`, only from the stamped date → freezes nothing, notifies the brand,
the brand may still confirm and pay. Recorded on `collab_content` plus a `collab_events` row. J1
skips any collaboration carrying a brand report (defensive).

### Delayed, Needs You, reminders
Past the posting date with the content not live → Delayed with one of five content stages, told
**once**; the stage then **follows the collaboration silently, across phases**. Needs You and the
48-hour reminders share `openContentMove`; content reminders **continue past the posting date**
(v1.29) until the move, a report or completion.

### Privacy
Files belong to the collaboration: the owning brand, that creator, Admin only once reported.
Private R2 objects under `collab-content/<ciId>/`, 300-second signed GETs, never `putBuffer`, never
`brand_media_assets`, never `/uploads`.

### Admin numbers
`content_change_rounds` (2), `content_report_silence_days` (7), and `final_payment_wait_days` (7,
moved from `payment_config.tranche_3_release_after_days`, which is now unread and left in place).

### Adjacent money fixes (Q13, Q14)
The manual admin release keeps working for item 18 but writes an audit row with a required reason
and refuses `disputed` / `refunded` rows. A collaboration with a queued tranche cannot be cancelled
through the campaign-cancel path. No false low-wallet SMS for already-locked tranches; a queued
tranche counts as pending for her; "still locked" from escrow; completion is never lost to a
notification failure.
