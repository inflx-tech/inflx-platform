# Item 12 — Pay for Content, from the shoot to the last rupee: gap report (Phase 1)

**Read and report only.** Nothing was changed in code, no migration was run, no data was written. Production was
read with `SELECT`s inside `BEGIN TRANSACTION READ ONLY`, plus one anonymous `GET` of a public stock-image URL
to learn which storage production uses. No money moved anywhere.

Sources, in order of authority: rules doc **v1.28** (§12.2, with §3, 7A, 9, 10, 11, 19, 21, 22, 24–28, 31) →
locked mockups **C1–C17** plus their rules table → the gap prompt. The repo is the truth; items 2–11's reports
were read as guides only. Paths are relative to the repo root; `B/` = `backend/src/`, `M/` =
`Packages/Mobile/src/`, `W/` = `Packages/brand-web/`.

---

## 0. The eight things to read first

1. **Money can already leave for Pay for Content without anything item 12 asks for.**
   `POST /v1/deliverables/:id/confirm-live` (`B/routes/deliverable.routes.js:45`,
   `B/controllers/deliverable.controller.js:339-478`) is mounted for any brand, and the brand website calls it
   (`W/app/dashboard/campaigns/[id]/page.js:357-368`). It asks for no shoot, no signature, no Aim and no dispute check.
   Once every legacy `deliverables` row is `live`, it releases **tranche 2** and **queues tranche 3**, and the
   hourly job pays the 50% seven days later. The legacy chain it needs (`/submit` → `/review` →
   `/submit-live`) is also live and ungated. Both signed Pay for Content collaborations in production already
   have `pending` rows for it. **Phase 2a must close this before anything else is built.**
2. **The final-payment waiting period is not stamped and is not a platform setting.** It lives in
   `payment_config.tranche_3_release_after_days` (7 in production). The tranche-3 job reads it **live** on every
   run (`B/jobs/tranche-3-release.job.js:16`), so changing it moves collaborations already waiting. That breaks
   check 19.
3. **The locked mockups conflict with the rules on the fee split.** C2/C11/C12/C13 split **₹12,960** into
   3,240 / 3,240 / 6,480. ₹12,960 is exactly production's `locked_amount` for Asha's collaboration, which is the
   fee ₹12,000 **plus** the ₹960 campaign fee. Rules §3/§9 and the code split the **fee alone**: production
   holds 3,000 / 3,000 / 6,000. C16's "₹9,720 stays locked" has the same problem. **Q1 — needs the founder.**
4. **The content step has no platform field per row, but it does not need one.** A row is `{type, count}`, and
   the five types (`reel, post, story, youtube_video, youtube_short`) each belong to exactly one platform
   (`B/services/invitationCopy.js:59-65`). The platform is therefore derivable; nothing names it separately.
   `story` exists, so C10's screenshot rule can be decided from the type.
5. **Storage is ready; the phone's upload helper is not.** Production uses real Cloudflare R2 (bucket
   `inflx-assets`, private, presigned GETs — observed live). The committed `.env.prod-backup` says
   `R2_MOCK=true` and is stale. Presigned PUTs already exist. The gallery picker is in the installed APK.
   However, `uploadFile` reads the whole file into memory (`M/services/api.js:780-786`) and times out at
   5 minutes. That will not survive a 200 MB video. There is an OTA-safe fix (a streaming `{uri}` body), but it
   must be proved on a phone in Phase 2b. **There is no video player in the binary**: video review goes out
   through `Linking.openURL(signedUrl)`, as items 7 and 11 already do for PDFs.
6. **Delayed is written once and never updated.** Both arms need `delayed_at IS NULL` and nothing ever changes
   the stage afterwards. A collaboration flagged at a shoot stage would therefore keep saying "address not sent"
   while its content sits in review. Asha's `d3fde0dc…` is already flagged `address_not_sent`. **Q9.**
7. **The Store Visit legacy "Mark visit done" button on the brand website can break the "shoot done" test.**
   `POST /production-events/:id/complete` is still live for Store Visit
   (`B/controllers/production.controller.js:618-665`). One brand tap sets `brand_completed_at` without
   `status='completed'`. The item 10 screens then say "Shoot done", yet the content gate stays shut and the shoot
   can never finish. Retire it in 2a.
8. **Production today:** 2 signed Pay for Content collaborations, both Kanchi Silks (practice) × Asha M.
   (practice), both Remote, **neither shoot done**. There are no content rows of the new kind. **No tranche 2
   or tranche 3 has ever been released**. No Pay for Content collaboration is marked Completed. No backfill is
   needed. §3's last row has the detail.

---

## 1. Summary

| Area | Status | One-line gap |
|---|---|---|
| The gate (shoot done + Pay for Content) | **P** | `shootGate` covers signed + funded. Nothing tests "shoot done" or the Aim for content, and the legacy content endpoints ask neither. |
| Money: tranche 2 / tranche 3 | **P / C** | `processTrancheRelease` is right and reusable. The only T2 door is the ungated legacy `confirm-live`. T3's wait is read live, never stamped. The job has no `SKIP LOCKED`, and completion is skipped if a notification throws. |
| Deliverable rows | **E** | Signed rows are in `contracts.terms_json.work.deliverables` (`{type,count}`, no duplicate type). The platform is implied by the type. No row id beyond the type. |
| Content package, files, rounds, notes | **M** | Legacy `deliverables` holds one URL/file per unit, no rounds history, no per-file notes and no caption per row. A new model is needed. |
| Posting proof (links / Story screenshot) | **M** | Legacy `live_url` is one per unit, with no screenshot and no "she confirmed she posted". |
| Confirm live, no auto-confirm | **C** | The legacy door exists and pays, but it is ungated and uses the wrong trigger (per-unit "all live"). |
| Final 50% job + Completed | **P** | `tranche-3-release.job.js` exists at `:00`. It needs a stamped due date, per-row locking, idempotent completion and no SMS. |
| Reports (disputes) | **M** | There is no disputes table. Item 11 records reports as columns on `production_events`. Nothing is content-shaped. |
| Delayed: content stages | **P** | CHECK has `content_not_live` only; all 5 new stages are missing. The flag is never updated after the first write. |
| Needs You + 48 h reminders | **P** | The backend counts legacy `deliverables` with no shoot or Aim filter. The phone renders no Needs You list (§24 deferred). The reminder lane at `:55` takes a third arm. |
| Notifications | **P** | The `deliverable.*` keys are legacy and deep-link to screens that don't exist. No `content.*` namespace. |
| Admin numbers | **P** | The page is data-driven; two new keys need a row plus `DEFAULTS`/`DESCRIPTION`. The waiting period lives on a different page and table (Q4). |
| Storage + upload | **P** | R2 is private and presigned. The phone upload helper can't carry 200 MB. There are no size caps on the old deliverable URL. |
| Privacy | **C** | Legacy `GET /deliverables/:id` and `/media-url` serve to any non-brand, non-creator role. Mock mode serves `/uploads` publicly. |
| Creator screens C1, C3–C5, C8, C10, C12, C15 | **M** | No content screen exists (deleted in the 2026-09-10 strip). The doors at the shoot screens' done states are ready. |
| Brand screens C2, C6, C7, C9, C11, C13, C14, C16 | **M** | Same. The brand website has a live Approve / Revision / Confirm-live panel that must go read-only. |
| Admin C17 | **P** | Two rows, no page change. |
| Tests | **E** | Baseline recorded as `backend/baseline_item12.json` (§13). |

---

## 2. Requirement table

Status: **E** exists · **P** partial · **M** missing · **C** conflicts. Risk: H/M/L.

### Data (D1–D12)

| ID | Requirement | St | Evidence | Proposed change | Risk |
|---|---|---|---|---|---|
| D1 | One content step per collaboration, stage derived from timestamps | M | Nothing opens after the shoot. "Your content step is open" is notification text only (`B/services/shootPlan.service.js:407`, `B/services/remoteReturn.service.js:180`). | New `collab_content` table, 1:1 with `campaign_influencers`, created on the first write after the gate passes. All D1 fields are timestamps or stamped numbers (§8). | M |
| D1 | Rounds allowed, stamped at first submission | C | `contracts.revision_limit` is hard-coded to 2 (`B/services/contract.service.js:126-137`) and copied onto each legacy row (`B/services/contractSign.service.js:219-221`). | `collab_content.rounds_allowed`, stamped from `content_change_rounds` in the G5 transaction when it is still NULL. `contracts.revision_limit` is left alone and unread. | M |
| D1 | Approved at/by, posted at, report-after days, live at/by, due at, T2/T3 released at, completed at, reported at/by/kind | M | — | Columns on `collab_content` (§8). `reported_kind CHECK IN ('rounds_used','posted_wrong','brand_silent')`. | M |
| D2 | Deliverable rows from the agreement, never editable | E | `contracts.terms_json.work.deliverables` built at `B/services/agreementTerms.service.js:224, 271-277`; `{type,count}`; item-5 validation `B/services/invitationTerms.service.js:130-146` (1–20, no duplicate type). | Read only from `terms_json`. Row key = `type` (unique per agreement by §7A). No write path for rows exists or will exist. | L |
| D2 | Type names a platform | P | No platform field. Labels map type → platform (`B/services/invitationCopy.js:59-65`): reel/post/story → Instagram; youtube_video/youtube_short → YouTube. | A single `PLATFORM_OF_TYPE` map in the new copy file; `story` ⇒ screenshot proof. **Say plainly: the type list has no separate platform, but every type implies exactly one.** | L |
| D3 | Files: row, kind, ≤10 MB photo / ≤200 MB video, ≤10 per row, round kept, private key, per-file note | M | Legacy `deliverables.media_key/media_type` is one file per unit (`backend/migrations/009_deliverable_media.sql:4-6`); `/upload-url` has **no size cap** and a loose type check (`B/controllers/deliverable.controller.js:484-516`). | New `content_files` (immutable; `added_round`/`removed_round`) and `content_file_notes`. Server validates the declared type and size at URL issue and the **real** size and type via `headObject` at confirm (§6). | H |
| D3 | Caption per row ≤500, optional | M | Legacy `caption_draft` is per unit. | `content_captions(content_id,row_key,caption)` for the draft; each round's captions frozen in `content_rounds.package_json`. | L |
| D4 | Complete or nothing; locked in review; one verdict; rounds; last-round warning; no third round; idempotent | M | Legacy `/review` is per unit, feedback optional on the server, `REVISION_LIMIT_EXCEEDED` (`B/controllers/deliverable.controller.js:186-250`). | G5/G6/G7 with compare-and-swap on the round number (§9). | H |
| D5 | Link per deliverable; screenshot for a Story; her confirmation; brand's two answers | M | Legacy `live_url` is per unit; no screenshot; no "posted" moment. | `content_proofs(content_id,row_key,slot,url | screenshot_file_id)`; `collab_content.posted_at`. | M |
| D6 | Second 25% at confirmation, final 50% by job at the stamped due, nothing deducted, nothing else | P/C | `B/services/escrow.service.js:114-256` (release); `B/controllers/deliverable.controller.js:413-442` (only T2 door, ungated); `B/jobs/tranche-3-release.job.js:16-49` (live wait). | §3: call `processTrancheRelease` from a new `contentMoney` service; stamp `escrow_entries.release_due_at`; the job selects on it. | **H** |
| D7 | Delayed with the five content stages | P | CHECK (live, production): `plan_not_sent, time_not_agreed, not_attended, not_confirmed, content_not_live, address_not_sent, not_booked, in_transit, not_checked, shoot_not_marked` (`backend/migrations/191_item11_remote.sql:84-88`). | Widen with **all five** new values (none exist). Keep `content_not_live` unwritten. Third arm in `collab-delayed.job.js`. Q9 on re-flagging. | M |
| D8 | Needs You + 48 h reminders | P | `B/services/collabCounts.service.js:241-244` counts legacy `pending/revision_requested` with no shoot/Aim filter; `socialState` only ever `posted/submitted/none` (`:158-159, 378-379`). Reminder lane `B/jobs/shoot-reminders.job.js` at `:55`. | One `openContentMove(state)` rule used by Needs You and the reminder lane. `collab_content.reminder_sent_at`. | M |
| D9 | Two new Admin numbers + the existing waiting period | P | `B/services/platformSettings.service.js:19-53`; waiting period is `payment_config.tranche_3_release_after_days` (`backend/migrations/186_item9_fee_override_and_t3_wait.sql:55-60`), edited at `W/app/admin/settings/payments/page.js:35`, no range check. | Migration rows + `DEFAULTS` + `DESCRIPTION` for `content_change_rounds` (2, 1–5) and `content_report_silence_days` (7, 1–30). Waiting period: Q4. | M |
| D10 | Files private: brand, creator, Admin on a dispute | C | Legacy `GET /deliverables/:id` and `/media-url` serve any role except a *mismatched* brand/creator (`B/controllers/deliverable.controller.js:80-85, 522-531`). Mock mode serves `/uploads` with no login (`B/app.js:57-58`). | Retire both legacy reads. New G12 with a 300 s signed GET (item 7's precedent). Mock mode streams through an authenticated route. | **H** |
| D11 | Notifications | P | Legacy `deliverable.*` keys (`B/controllers/deliverable.controller.js:167,233,266,322,453`), deep-linking to `deliverable_review`/`deliverable_detail`, which no phone screen handles. `tranche.released` sent **with SMS** (`B/jobs/tranche-3-release.job.js:71-76`). | New `NOTIFY12` block in a `contentCopy.js` (item 10/11 pattern), push + in-app, no SMS. | L |
| D12 | Legacy data | E | Production: 6 `deliverables` rows, 5 on the two signed Pay for Content collaborations (all `pending`), 1 `submitted` reel on an **unsigned** collaboration. | No backfill. Leave rows untouched; new screens never read them (§4). | L |

### API (G1–G13, J1, J2)

| ID | Requirement | St | Evidence | Proposed change | Risk |
|---|---|---|---|---|---|
| G1 | Content state, both sides | M | Shoot reads exist (`/…/shoot`, `/…/remote`: `B/routes/item10.routes.js:26,35`, `B/routes/item11.routes.js:29,47`). | `GET …/content` on each side (§9). | M |
| G2 | Upload a file | P | Presigned PUT helper `B/services/storage.service.js:54-78` (900 s); `headObject` `:226-245`; the verify-after-upload pattern `B/controllers/influencer.controller.js:602-609`. | `POST …/content/files/upload-url` + `POST …/content/files/:fileId/confirm`. | H |
| G3 | Remove/replace before submitting | M | — | `DELETE …/content/files/:fileId` (replace = delete + add). | L |
| G4 | Caption | M | — | `PUT …/content/rows/:rowKey/caption`. | L |
| G5 | Submit the package | C | Legacy `/submit` per unit, no gate (`B/controllers/deliverable.controller.js:119-175`). | `POST …/content/submit`; retire legacy. | H |
| G6 | Approve | C | Legacy `/review` approve (`:186-233`). | `POST …/content/approve`. | M |
| G7 | Ask for changes | C | Legacy `/review` request_revision, reason optional (`:236-266`). | `POST …/content/changes`. | M |
| G8 | Link or screenshot per row | C | Legacy `/submit-live` (`:287-330`). | `PUT/DELETE …/content/proofs/:rowKey/:slot`. | L |
| G9 | Confirm posted | M | — | `POST …/content/posted`. | L |
| G10 | Confirm live → second 25% | **C** | Legacy `/confirm-live` pays T2 ungated (`:339-478`). | `POST …/content/confirm-live`; retire legacy. | **H** |
| G11 | Report to INFLX | M | Item 11 pattern: `B/services/remoteReturn.service.js:112-138`. | `POST …/content/report` on each side. | M |
| G12 | View a file | C | Legacy `/media-url` 3600 s and weakly checked. | `GET …/content/files/:fileId/url` (both sides) + admin variant. 300 s. | H |
| G13 | Admin: two numbers | P | `GET/PUT /admin/platform-settings` (`B/routes/item6.routes.js:43-44`, `B/controllers/negotiations.controller.js:145-154`). | Rows only (§8). | L |
| J1 | Release the final 50% at the stamped due; Completed | P | `B/jobs/tranche-3-release.job.js` (hourly `:00`, `B/jobs/index.js:69`). | Extend this job rather than add a second (§10). | H |
| J2 | Delayed content arm; 48 h content arm | P | `B/jobs/collab-delayed.job.js` (`:05`), `B/jobs/shoot-reminders.job.js` (`:55`). | A third arm in each (§10). | M |

### Screens

Every screen is **M** on the phone. §11 has the per-screen plan. C17 is **P** (rows only).

---

## 3. The money, first and in full

### 3.1 The machinery as item 9 left it

| Thing | What it is | Evidence |
|---|---|---|
| `escrow_entries` | 3 rows per funded collaboration: tranche 1/2/3, `amount`, `escrow_fee_amount` (always 0), `net_to_influencer` (= amount), `status escrow_status` (`locked, queued, processing, released, disputed, refunded`), `trigger_event` (`contract_signed, content_live, day_30_post_live`), `triggered_at`, `released_at`, `razorpay_payout_id`, `fee_gst_amount`. Unique `(campaign_influencer_id, tranche_number)`. **No `created_at` column** (verified in production). | `backend/migrations/001_initial_schema.sql:361-373`; `037:89`; `076:16`; `183:21-25` |
| `contracts.locked_amount` | Fee **+ campaign fee**, written once at the brand's signature, **never decremented**. | `B/services/contractSign.service.js:105, 153-167` |
| `contracts.released_amount` | **Tranche 1 only**, written once. The Collabs card reads it as "first payment" (`B/services/invitationRows.service.js:507`). Item 12 must **not** overwrite it. | `B/services/contractSign.service.js:189-190` |
| `contracts.campaign_fee_amount` | The campaign fee, charged once to the brand as a `platform_fee` wallet debit. No release path touches it. | `:142-149` |
| `influencer_ledger` | Free-text `type`; tranches are `tranche_release`, `source='escrow'`, credit to `wallet_balance`. Production: 4 rows, ₹8,625, all tranche 1. | `backend/migrations/112_commerce_settlement_hold_and_ledger.sql:51-64` |
| `wallet_transactions` | Brand-only. A release writes an `escrow_release` credit and a `payout` debit with the brand's balance **unchanged** — an audit pair, not a movement. | `B/services/escrow.service.js:213-237` |
| Creator balances | `influencers.wallet_balance`, `total_earned` (+ net at each release); `pending_balance` untouched. | `:165-178` |
| Split | `splitAmount` of the **fee** by `payment_config` 25/25/50; the three parts always sum to the fee. Snapshot: `terms_json.money.split {t1,t2,t3}`. | `B/services/agreementTerms.service.js:149-167`; `B/services/escrow.service.js:66-96` |

**Tranche 1 at signing** (`contractSign.brandSignInTx`, one transaction): lock brand `FOR UPDATE` and debit
fee + campaign fee (`:121-133`) → `escrow_lock` debit (fee) + `platform_fee` debit (campaign fee)
(`:136-149`) → compare-and-swap the contract to `active` with `locked_amount`, `campaign_fee_amount`, `money_at`
(`:153-167`) → 3 escrow rows `locked` (`B/services/escrow.service.js:80-96`) →
`processTrancheRelease(T1)` (`B/services/contractSign.service.js:186-188`) → `released_amount = T1`
(`:189-190`) → shoot row → legacy `deliverables` rows, one per unit (`:213-224`).

### 3.2 What a tranche-2 and a tranche-3 release must write

Exactly what tranche 1 wrote, through the **same function** —
`escrowService.processTrancheRelease(client, entryId, influencerId, brandId, campaignId)`
(`B/services/escrow.service.js:114-256`), called inside the caller's transaction:

- escrow row: `FOR UPDATE`, then a compare-and-swap `status='released', released_at=now(), razorpay_payout_id='tranche_N_<ts>'` `WHERE status<>'released'`;
- creator row `FOR UPDATE`, then `wallet_balance += net`, `total_earned += net` (net = amount; **nothing deducted**);
- one `influencer_ledger` credit `tranche_release`;
- brand `escrow_release` credit + `payout` debit at an unchanged balance;
- the referral accrual in a savepoint (its base is `escrow_fee_amount` = 0, so a harmless ₹0 row at most).

Item 12 adds, in the same transactions:

| Moment | Also written |
|---|---|
| **G10 confirm live** | `collab_content.live_confirmed_at/by`, `final_wait_days` (stamped), `final_due_at`, `t2_released_at`; T3 row → `status='queued', triggered_at=now(), release_due_at=<stamped due>` `WHERE status='locked'`. |
| **J1 final 50%** | `collab_content.t3_released_at`, `completed_at`; `campaign_influencers.status='completed'` (what the job already does, `B/jobs/tranche-3-release.job.js:92-101`); the campaign-completion check that is already there (`:104-118`). |

`contracts.locked_amount` stays as it is: it records what was locked. After tranche 3 the escrow rows show
fee = released. **One defect to fix in item 12:** `agreement.service.moneySummary` computes "still locked" as
`locked_amount − released`, so after tranche 3 it shows the **campaign fee** as still locked, forever
(`B/services/agreement.service.js:181-195`). The fix is to compute from escrow rows only.

**Nothing is deducted — proved in code.** `escrow_fee_amount=0` and `net=amount` at creation
(`B/services/escrow.service.js:69-91`); the credit is `net_to_influencer` (`:171-178`); TDS and the minimum
withdrawal apply only at withdrawal (`B/services/withdrawal.service.js:123-155`). In production all 12 escrow
rows have `escrow_fee_amount = 0` and `net = amount`.

### 3.3 Every existing release path, and whether it can fire for Pay for Content today

| # | Path | Can it fire for Pay for Content today? | Item 12 |
|---|---|---|---|
| A | `POST /v1/deliverables/:id/confirm-live` → releases T2, queues T3 (`B/controllers/deliverable.controller.js:339-478`; brand website `W/app/dashboard/campaigns/[id]/page.js:357-368, 794-820`) | **Yes.** No shoot, signature, Aim, dispute or cancelled check. Legacy rows exist on both production collaborations. | **Retire in 2a** (`RETIRED_…`, data kept); its release logic moves into `contentMoney`. |
| B | `tranche-3-release.job.js` hourly `:00` → releases `queued` T3 after the **live** `tranche_3_release_after_days` | Only after A (or C) queues a row. None is queued in production. | Extend (§10): stamped due, `SKIP LOCKED`, idempotent completion, no SMS. |
| C | `POST /admin/escrow/:id/release` (`B/controllers/admin.controller.js:433-468`, `escrow` capability) — any tranche, reason logged to the console only | **Yes**, by an admin's hand, for any tranche. Doesn't queue T3, doesn't complete, no audit row, would pay a `disputed`/`refunded` row. | **Q13.** Recommend leaving it for item 18 (dispute settlement needs it), but writing an audit row and refusing `disputed/refunded` rows. |
| D | Brand signature → T1 only | Correct, unchanged. | — |

**Production state:** no T2 or T3 has ever been released or queued. All four funded collaborations (2 Pay for
Content, 2 Hybrid) have `1:released, 2:locked, 3:locked`.

### 3.4 How item 12 calls it without duplicating it

A new `B/services/contentMoney.service.js`, the **only** place outside the brand signature that releases a
fixed-fee tranche. Items 14 and 15 will call it too.

```
releaseSecond(client, ciId, byUserId)  // T2 FOR UPDATE, locked → processTrancheRelease, queue T3 with release_due_at
releaseFinal(client, escrowId)          // T3 FOR UPDATE SKIP LOCKED, queued + due → processTrancheRelease, complete
```

G10 calls `releaseSecond` inside its compare-and-swap transaction. J1 calls `releaseFinal` per row.
`processTrancheRelease` is unchanged.

### 3.5 Money defects found on the way (all small, all touched by item 12's own states)

| Defect | Why item 12 must care | Proposal |
|---|---|---|
| The low-wallet alert job SMSes a brand whose balance is below its largest **queued** tranche (`B/jobs/low-wallet-alert.job.js:10-39`). That money was locked at signing. | Item 12 is the first thing that queues a T3 in production. The brand would get a false "top up your wallet" SMS the next morning. | Ignore escrow rows (already funded) in that job. |
| Creator earnings `pending_amount` counts only `locked` rows (`B/controllers/influencer.controller.js:1159`; `B/services/commission.service.js:269-272, 403-404`). | A queued T3 (₹6,000) disappears from "pending" for 7 days. | Count `queued` as pending. Also relabel "Day 30 Post-Live" (`commission.service.js:381`). |
| `stillLocked` shows the campaign fee after T3 (§3.2). | C13 would show money still locked on a completed collaboration. | Compute from escrow rows. |
| The T3 job skips completion if the notification insert throws (`B/jobs/tranche-3-release.job.js:69-120`). | The collaboration would stay not-Completed forever. | Completion inside the release transaction; notify after commit. |
| `B/controllers/escrow.controller.js:114` selects `ee.created_at`, which does not exist. | `GET /brands/me/campaigns/:id/escrow` errors. Not item 12's; noted. | Separate fix (task chip). |
| Campaign cancel writes `escrow_entries.status='cancelled'`, not an enum value (`B/controllers/campaign.controller.js:1466-1475`). It also refunds only `locked`, so a `queued` T3 would still pay after a cancel. | Only matters once item 12 queues a T3. | Separate fix before a real cancel. Noted, not item 12. |

---

## 4. What already exists for content submission and review — keep, extend or retire

| Part | Real name | Verdict | Why |
|---|---|---|---|
| Work-unit table | `deliverables` (`backend/migrations/001_initial_schema.sql:248-264`; `009:4-6`) — one row per **unit**, status `pending…live`, `submitted_url`, `media_key`, `live_url`, `revision_count/limit`, `brand_feedback` (latest only), `caption_draft` | **Keep the rows, stop writing them** | One file per unit, no rounds history, no per-file notes, no screenshot. Rows are built from **live** `formats_json`, not the signed snapshot (`B/services/contractSign.service.js:242`). Item 12's package keys off the agreement instead. |
| Row birth at countersign / on the creator's read | `contractSign.service.js:213-224`; `influencer.controller.js:1710-1757` | **Keep** (harmless) | `deliverable_stats` + the Apify job read these rows. |
| `/submit`, `/upload-url`, `/review`, `/bulk-review`, `/submit-live` | `B/routes/deliverable.routes.js:24-42` | **Retire** (`RETIRED_12_*`, item 10/11 pattern `B/controllers/production.controller.js:19-60`) | Ungated, one file, feedback optional, no size cap. |
| `/confirm-live` | `:45` | **Retire the door, keep the logic** in `contentMoney` | §3. Retire it for **every Aim**: Pay for Sale has no escrow, and Hybrid's T2 belongs to item 15 through the same new service. Production has no Hybrid deliverables rows. |
| `GET /:id`, `/media-url` | `:27, :33` | **Retire** | Privacy (D10); no phone caller; the brand website loses its panel anyway. |
| `/refresh-stats`, `deliverable_stats`, `apify-engagement.job` | `:48`; `B/jobs/apify-engagement.job.js` | **Keep** | Stats, untouched. |
| Brand inbox list + `pending_reviews`; `collabCounts`; the campaign page's counts; "End campaign" guard | `B/controllers/brandInbox.controller.js:83-153`; `B/services/collabCounts.service.js:104-109, 241-244`; `B/controllers/campaign.controller.js:454-520, 1588-1607` | **Extend**: read `collab_content` | Otherwise both sides count ghost work. |
| `collabStep.socialStep` | `B/services/collabStep.service.js:192-204` (submitted/changes_asked/approved/posted/confirmed) | **Extend**: feed it the real content state | The vocabulary already fits; callers only ever pass `posted/submitted/none`. |
| `deliverable.*` notification keys | `deliverable.controller.js:167…608` | **Retire** (no new sends) | Replaced by `content.*`. |
| Brand website Approve / Revision / "Confirm live · release T2" panel, inbox "Content reviews" tab, CommandRail "Review N" | `W/app/dashboard/campaigns/[id]/page.js:338-368, 755-829`; `W/app/dashboard/inbox/page.js:12, 268-300`; `CommandRail.js:34-38` | **Retire what it renders** | One read-only card: "Content is reviewed and confirmed in the app." (item 11's `ProductionPanel` pattern). |
| Phone API wrappers + orphan helpers | `M/services/api.js:421-422, 639-646`; `M/utils/collabDetailModel.js`, `M/components/collabs/CollabRow.js`, `M/components/brand/NeedsYou.js`, `M/utils/collabStages.js`, `M/utils/creatorSteps.js`; `Packages/shared/api/deliverable.api.js` | **Retire** | Dead code, no screen imports them. |
| `contracts.revision_limit` | always 2 | **Leave, unread** | Replaced by the stamped `rounds_allowed`. |
| Admin manual escrow release | §3.3 C | **Keep, harden** (Q13) | Item 18 needs it. |

Unrelated look-alikes, out of scope: `creator_posts`/`post_media` (shoppable posts, items 13–16), `post_events`
(follower behaviour log), `posts`/`creator_social_posts` (scraped profile data). None touches `deliverables`.

---

## 5. The gate

**The one "shoot is done" test, both modes:** `production_events.status = 'completed'` for the contract's
event. Every completing path writes it, always together with `influencer_completed_at`:

| Path | Writes | Evidence |
|---|---|---|
| Store Visit — brand confirms | `brand_completed_at/by`, `visit_completed_at`, `status='completed'` | `B/services/shootPlan.service.js:400-404` |
| Store Visit — auto-confirm job (`:45`) | `auto_confirmed_at`, `visit_completed_at`, `status='completed'` | `:418-452` |
| Remote — creator marks done | `influencer_completed_at`, `status='completed'` | `B/services/remoteReturn.service.js:173-176` |
| **Legacy** `POST /production-events/:id/complete` (Store Visit branch live, called by the brand website "Mark visit done", `W/app/dashboard/campaigns/[id]/influencers/page.js:267-273, 505`) | its own side's column; `status='completed'` only when both have tapped | `B/services/production.service.js:660-716` |

"Shoot done on {date}" (C1) = `COALESCE(auto_confirmed_at, brand_completed_at)` for a visit and
`influencer_completed_at` for Remote.

**Do not** use `shootPlan.stageOf` (it treats `brand_completed_at` alone as complete,
`B/services/shootPlan.service.js:96`).

**Proposed gate** — `assertContentOpen(ciId, conn)` in a new `B/services/contentGate.service.js`, called on
every content path, reads **and** writes:

1. `refuse(await shootGate(ciId, conn))` — signed + funded + T1 released (`B/services/shootGate.service.js:39-65`); reuses `NOT_SIGNED`/`NOT_FUNDED`.
2. `goal === 'engagement'` (Pay for Content; `campaign_sets.goal`, `B/services/shootGate.service.js:27, 44`) else **404-shaped `NOT_PAY_FOR_CONTENT`** "This collaboration doesn't use this step."
3. `pe.status === 'completed'` else `SHOOT_NOT_DONE` "The shoot isn't done yet."
4. Ownership: brand = owning brand; creator = that creator; everything else 404.

**Every path into the content step today:**

| Path | Checks today |
|---|---|
| Legacy `/deliverables/*` (8 routes) | Login + role (+ ownership for brand/creator only). **No gate, no shoot, no Aim.** → retired in 2a. |
| `collabStep.stepForCollaboration` | Moves the step past 3 when `shootDone` — a label only (`B/services/collabStep.service.js:154-170`). |
| Shoot screens' done states | Display "content step is open" — no action (`M/screens/influencer/ShootScreen.js:132-138`, `M/screens/influencer/RemoteShootScreen.js:199-211`). |
| Admin manual escrow release | Capability only (§3.3 C). |

**Retire in 2a:** the Store Visit branch of `POST /production-events/:id/complete` (item 10's flow fully
covers it), turning the brand website's "Mark visit done" into the read-only card. **No production row is in
the stuck state today:** all 3 `completed` visit events are on unsigned contracts; the 2 signed visit
collaborations are `confirmed` with neither mark.

**Production strays that the gate already refuses:** 1 `completed` visit event on an **unsigned** Pay for
Content collaboration; 1 `submitted` legacy reel on an unsigned collaboration (`ci.status='active'`).

---

## 6. Storage and uploads

**Where files live.** Cloudflare R2 through the S3 SDK, one private bucket (`env.R2_BUCKET`; production =
`inflx-assets`, observed from a public stock-image redirect). There is no public bucket domain in the code;
every read is a presigned GET (`B/services/storage.service.js:54-101, 176-190`).

**Every limit in the stack:**

| Layer | Limit | Evidence |
|---|---|---|
| JSON body | 5 MB | `B/app.js:71` |
| urlencoded body | 100 KB (Express default) | `B/app.js:73` |
| multer (mock upload) | 100 MB — **below 200 MB** | `B/controllers/upload.controller.js:16-19` |
| Presigned PUT | none — S3/R2 can't cap size on a presigned PUT; checked afterwards | `B/services/storage.service.js:221-224` |
| R2 single PUT | ~5 GB (Cloudflare's published limit; not in the repo) | — |
| Render / nginx | no `render.yaml` or nginx config in the repo; **no body passes through Render** in the proposed path | — |
| Phone picker helper | refuses > 5 MB and resizes to 1600 px — **not** to be reused for content | `M/components/discovery/ImagePickerField.js:18-31` |
| Phone upload XHR | 5-minute timeout; reads the whole file into a Blob | `M/services/api.js:763, 780-786` |

**The path for a 200 MB video — nothing passes through the API server:**

1. `POST …/content/files/upload-url {row, kind, mime, size, durationS?, purpose}` → gate, lock check, row
   check, count check (≤10), type (`image/jpeg|image/png|video/mp4`) and declared size (≤10 MB / ≤200 MB).
   The server generates the key `collab-content/<ciId>/<uuid>.<ext>`, inserts a `content_files` row with
   `verified_at NULL` (not counted), and returns a presigned PUT (content type signed, ~30 min).
   **To prove in 2b:** also signing `Content-Length` so R2 rejects a body of a different size.
2. The phone PUTs straight to R2 with `xhr.send({ uri })`. React Native streams a `{uri}` body from disk with
   progress (`NetworkingModule.java:419-436, 563-580`; `RequestBodyUtil.java:146-171`). This is OTA-safe, but
   **unproved on a device**. The timeout is raised and the screen says to keep the app open.
3. `POST …/content/files/:fileId/confirm` → `headObject` → real size and type checked. On a mismatch the object
   is deleted and the message is the same one the app shows. Then `verified_at` is set. This goes through the
   normal API client, so the 401 → refresh → retry already works.
4. Unconfirmed rows older than 24 h are swept (object deleted) by the J2 lane.

Multipart upload is **not** needed at 200 MB. `@aws-sdk/lib-storage` is installed and unused.

**Serving privately (G12).** `GET …/content/files/:fileId/url` checks the gate and ownership and returns a
presigned GET of **300 s**, logged (item 7's `B/controllers/agreements.controller.js:77-103` precedent).
Admin gets one variant, only while `collab_content.reported_at IS NOT NULL`. In mock mode the file streams
through an authenticated route, never `/uploads`. **Never** write with `putBuffer` (it sets
`Cache-Control: public`, `B/services/storage.service.js:131-143`), and never store in `brand_media_assets`
(served with no login at `GET /v1/media/assets/:id`).

**Public endpoints item 12 must stay out of:** `/v1/media/assets/:id`, `/v1/media/stock/*`,
`/v1/media/post/:id`, mock `/uploads`, `/contracts/:id/pdf?download_token=`.

**The phone (bare React Native 0.73, no Expo; OTA runtime `NATIVE_RUNTIME='3'`, `M/services/otaUpdater.js:28`):**

| Need | In the installed APK? | OTA-safe answer | If not good enough |
|---|---|---|---|
| Pick photos/videos from the gallery | **Yes**, `react-native-image-picker` (`Packages/Mobile/package.json:27`; module in the APK). The system photo picker needs no new permission. Returns `file://`, `fileSize`, `duration`. | `launchImageLibrary({mediaType:'mixed', selectionLimit})` | — |
| Pick a Story screenshot | Yes (same) | `mediaType:'photo'` | — |
| Upload 200 MB with progress | Core networking | Streaming `{uri}` PUT | New APK with a background-upload module (not recommended now) |
| Show a photo | Core `<Image>` | signed URL | — |
| **Play a video** | **No** (no react-native-video / expo-video) | `Linking.openURL(signedUrl)` → the phone's browser/player (items 7/11's pattern); or `react-native-webview` (linked, **never used**) with `<video>` | New APK with `react-native-video` — Q11 |
| Video thumbnail | No | Tile with a play icon and the duration badge (picker's `duration`) | — |
| Resume an interrupted upload | No | Retry the whole file | — |

---

## 7. Link readiness (§3 of the prompt)

| Link | Ready? | What is missing / what item 12 consumes or exposes |
|---|---|---|
| **Items 10 and 11: the shoot** | **Ready, with one fix** | Test = `pe.status='completed'` (§5). Retire the legacy Store Visit `complete` branch. Nothing else can open the content step once the legacy `/deliverables` writes are retired. |
| **Item 9: the money** | **Ready to call, not safe as is** | Reuse `processTrancheRelease`. Retire door A. Stamp the due. Fix the four defects in §3.5 that item 12's states expose. Nothing deducts a fee. |
| **Item 7: the agreement** | **Ready** | Rows = `terms_json.work.deliverables` `[{type,count}]`; usage rights = `terms_json.work.usageRights {on,durationDays,places,words}`; money = `terms_json.money {fee, split{t1,t2,t3}, splitPct, campaignFee, totalToLock}`. **There is no platform field; the platform is implied by the type.** Both production Pay for Content snapshots carry rows (`post×4`, `reel×1`). A snapshot with empty rows (possible for an agreement whose creator row inherited set-level formats, `B/services/agreementTerms.service.js:224`) is refused with a clear error — Q7. |
| **Item 5: the terms** | **Ready** | Types `reel, post, story, youtube_video, youtube_short`; count 1–20; no duplicate type (`B/services/invitationTerms.service.js:130-146`). |
| **Item 10: Delayed, reminders, Needs You, copy, jobs** | **Ready to extend** | Delayed arm pattern `B/services/shootPlan.service.js:458-501` / `B/services/remoteJobs.service.js:107-171`; reminder arm pattern `remoteJobs.remindRemote` `:188-235` with `openMove()` `:244-295`; copy `B/services/productionCopy.js` (`MSG`, `NOTIFY`, `NOTIFY11`, stage labels `:226-240`); wrapper `notifyCreator/notifyBrand` (`B/services/shootPlan.service.js:553-562`). |
| **Storage** | **Ready on the server; the phone needs the streaming PUT** | §6. |
| **Item 18: disputes** | **Not ready (by design)** | Nothing dispute-shaped is written anywhere (`escrow_status 'disputed'` and `contract_status 'disputed'` exist, unused). Item 11 records reports as columns on `production_events`. Proposal: record on `collab_content` (`reported_at/by/role/kind/note`) **plus** a `collab_events` diary row (`B/services/collabEvents.service.js:97-150`). Do **not** flip escrow to `disputed` (item 18's job). Q12 on a shared `collab_reports` table. |
| **Items 14 and 15** | **Not ready (by design)** | §12. |
| **Notifications** | **Ready** | `notification.service.send` (in-app always, push always, SMS only on request, `B/services/notification.service.js:26-56`). |
| **Admin website** | **Ready** | Data-driven page `W/app/admin/settings/platform/page.js:127-163`. Nothing shows content or disputes today. |
| **Production data** | **Read** | Below. |

**Production, read on 25 Sep 2026:**

| Question | Answer |
|---|---|
| Signed Pay for Content collaborations | **2** — `d3fde0dc-196b-48e6-a9c4-b4727570298b` (fee ₹12,000, post×4, posting 23 Sep, flagged Delayed `address_not_sent`) and `ef874178-35f5-418d-9e28-06fdb40e026c` (fee ₹10,000, reel×1, posting 30 Sep). Both Remote, both `production_events.status='confirmed'`. |
| …with a completed shoot | **0** |
| New-style content rows | **0** (tables don't exist) |
| Legacy `deliverables` rows | 6: 5 `pending` on those two (4 post + 1 reel), 1 `submitted` reel on an **unsigned** collaboration |
| Marked content-live | **0** (`live_confirmed_at` all NULL) |
| Marked Completed | 1 — a Pay for Sale collaboration from 21 Aug (pre-rebuild); **0** Pay for Content |
| Tranche 2 or 3 released or queued | **0**. All 4 funded collaborations: `1:released, 2:locked, 3:locked` |
| `payment_config` | 25/25/50; `tranche_3_release_after_days = 7`; release time 03:00 IST |
| `platform_settings` keys | `campaign_fee_pct 8, min_shoppable_posts 1, negotiation_rounds 2, pitch_cooldown_days 30, pitch_response_days 30, pool_lifetime_days 30, remote_return_autoconfirm_days 7, remote_return_days 7, shoot_auto_confirm_days 3, subscriptions_enforced 0` |

**Would either jump into an unexpected state?** No. Both show C15 "Shoot not done yet" until Asha finishes
item 11's Remote flow. `d3fde0dc…` is already Delayed at a shoot stage; Q9 decides what it says after the shoot.

---

## 8. Proposed migration (additive) — `192_item12_content.sql`

Next free number: **192** (last is `191_item11_remote.sql`; `run-191.js` exists). Idempotent, applied twice to
the test DB. **Money read before and after and must be identical — this migration moves none.**

```sql
-- 1. The content step: one per collaboration, created on the first write after the gate
CREATE TABLE IF NOT EXISTS collab_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_influencer_id uuid NOT NULL UNIQUE REFERENCES campaign_influencers(id),
  contract_id uuid NOT NULL REFERENCES contracts(id),
  rounds_allowed smallint,                  -- stamped at first submission (content_change_rounds)
  first_submitted_at timestamptz,
  current_round smallint NOT NULL DEFAULT 1, -- the submission being drafted or reviewed
  approved_at timestamptz, approved_by uuid, approved_round smallint,
  posted_at timestamptz, posted_by uuid,
  report_silence_days smallint, report_after_at timestamptz,   -- stamped at posted
  live_confirmed_at timestamptz, live_confirmed_by uuid,
  final_wait_days smallint, final_due_at timestamptz,          -- stamped at confirm live
  t2_released_at timestamptz, t3_released_at timestamptz, completed_at timestamptz,
  reported_at timestamptz, reported_by uuid, reported_role text,
  reported_kind text CHECK (reported_kind IN ('rounds_used','posted_wrong','brand_silent')),
  reported_note text CHECK (char_length(reported_note) <= 500),
  reminder_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
-- 2. Each submission, frozen: what was sent (rows, captions, file ids) and the verdict
CREATE TABLE IF NOT EXISTS content_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL REFERENCES collab_content(id),
  round_no smallint NOT NULL, submitted_at timestamptz NOT NULL, submitted_by uuid NOT NULL,
  package_json jsonb NOT NULL,
  verdict text CHECK (verdict IN ('approved','changes')), verdict_at timestamptz, verdict_by uuid,
  reason text CHECK (char_length(reason) <= 500),
  CHECK (verdict IS DISTINCT FROM 'changes' OR (reason IS NOT NULL AND btrim(reason) <> '')),
  UNIQUE (content_id, round_no)
);
-- 3. Files: immutable once submitted; a replacement is a removal plus an addition
CREATE TABLE IF NOT EXISTS content_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL REFERENCES collab_content(id),
  row_key text NOT NULL, purpose text NOT NULL CHECK (purpose IN ('content','story_proof')),
  kind text NOT NULL CHECK (kind IN ('photo','video')),
  mime text NOT NULL CHECK (mime IN ('image/jpeg','image/png','video/mp4')),
  size_bytes bigint NOT NULL, duration_s numeric(8,2),
  storage_key text NOT NULL UNIQUE,
  added_round smallint NOT NULL, removed_round smallint,
  uploaded_by uuid NOT NULL, uploaded_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz, deleted_at timestamptz,
  CHECK ((kind='photo' AND size_bytes <= 10485760) OR (kind='video' AND size_bytes <= 209715200))
);
CREATE TABLE IF NOT EXISTS content_file_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL REFERENCES collab_content(id), file_id uuid NOT NULL REFERENCES content_files(id),
  round_no smallint NOT NULL, note text NOT NULL CHECK (char_length(note) BETWEEN 1 AND 300),
  created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (file_id, round_no)
);
CREATE TABLE IF NOT EXISTS content_captions (
  content_id uuid NOT NULL REFERENCES collab_content(id), row_key text NOT NULL,
  caption text NOT NULL CHECK (char_length(caption) <= 500), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (content_id, row_key)
);
-- 4. Posting proof: one slot per deliverable of a row
CREATE TABLE IF NOT EXISTS content_proofs (
  content_id uuid NOT NULL REFERENCES collab_content(id), row_key text NOT NULL, slot smallint NOT NULL,
  url text, screenshot_file_id uuid REFERENCES content_files(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((url IS NULL) <> (screenshot_file_id IS NULL)), PRIMARY KEY (content_id, row_key, slot)
);
-- 5. The stamped due for the final 50% (nullable; NULL = the old live-setting rule)
ALTER TABLE escrow_entries ADD COLUMN IF NOT EXISTS release_due_at timestamptz;
-- 6. Delayed: widen with the five content stages (none exist today)
ALTER TABLE campaign_influencers DROP CONSTRAINT IF EXISTS ci_delayed_stage_known;
ALTER TABLE campaign_influencers ADD CONSTRAINT ci_delayed_stage_known CHECK (delayed_stage IS NULL OR delayed_stage IN (
  'plan_not_sent','time_not_agreed','not_attended','not_confirmed','content_not_live',
  'address_not_sent','not_booked','in_transit','not_checked','shoot_not_marked',
  'content_not_submitted','content_in_review','content_changes_requested','content_not_posted','content_not_confirmed'));
-- 7. Admin numbers
INSERT INTO platform_settings (key,value,min_value,max_value,unit,label) VALUES
  ('content_change_rounds',2,1,5,'rounds','Content change requests'),
  ('content_report_silence_days',7,1,30,'days','Brand silence before the Creator may report')
ON CONFLICT (key) DO NOTHING;
-- 8. Indexes
CREATE INDEX IF NOT EXISTS idx_content_files_live ON content_files (content_id, row_key) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_collab_content_open ON collab_content (campaign_influencer_id) WHERE completed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_escrow_t3_due ON escrow_entries (release_due_at) WHERE status='queued';
```

(Q4 may add a third `platform_settings` row, `final_payment_wait_days`.)

**`run-192.js --dry` prints:** target host (masked); whether each new table/column/constraint/row already
exists; the live CHECK values before and after; signed Pay for Content count (expect 2), shoot-done count
(expect 0); escrow per tranche per status and SUMs; `contracts.locked_amount/released_amount` SUMs;
`influencers` wallet SUMs; ledger count. **`--apply` reprints the money block and exits non-zero if any money
figure differs.** No backfill: no `collab_content` row is created for anyone.

---

## 9. Proposed endpoints

Brand base **`B = /campaigns/:id/sets/:sid/invitations/:ciId/content`**; creator base
**`C = /influencers/me/invitations/:ciId/content`** (item 10/11 naming, a new `item12.routes.js`). **Every
route** runs `assertContentOpen` (§5): signed + funded, Pay for Content, shoot done, the owning brand or that
creator; anything else is **404**. Every write is a compare-and-swap; G10 and J1 take the money rows
`FOR UPDATE`; notifications after commit.

| ID | Route | Body → response | Refusals (code → message, identical in the app) |
|---|---|---|---|
| G1 | `GET B`, `GET C` | → `{ stage, shootDoneAt, postingDate, delayed:{at,stage,label}, rows:[{key,type,label,platform,count,isStory,caption,files:[{id,kind,durationS,sizeBytes,notes:[{round,note}]}],proofs:[{slot,url,screenshotFileId}]}], round:{current,allowed,isLast,used}, rounds:[{no,submittedAt,verdict,verdictAt,reason}], approvedAt, postedAt, reportAfterAt, liveConfirmedAt, finalDueAt, money:{fee,t1,t2,t3,t1PaidAt,t2PaidAt,t3PaidAt,campaignFee}, usageRights, reported:{at,byRole,kind}, can:{upload,submit,approve,askChanges,addProof,markPosted,confirmLive,report,reportFrom}, completedAt }` | `SHOOT_NOT_DONE` is **not** refused on G1 — it returns `stage:'shoot_not_done'` so C15/C2 can draw it (item 10/11's F1 precedent). The Aim is still 404. |
| G2a | `POST C/files/upload-url` | `{rowKey,kind,mime,sizeBytes,durationS?,purpose}` → `{fileId,url,headers,expiresAt}` | `FILE_TOO_LARGE_PHOTO` "Photos have to be under 10 MB." · `FILE_TOO_LARGE_VIDEO` "Videos have to be under 200 MB." · `FILE_WRONG_TYPE` "Send a JPG, PNG or MP4." · `ROW_FULL` "You can add up to 10 to one deliverable." · `PACKAGE_LOCKED` "{Brand} are reviewing this. You can change it if they ask for changes." · `ALREADY_APPROVED` "This is already approved." |
| G2b | `POST C/files/:fileId/confirm` | → file | `UPLOAD_MISSING` "The upload didn't finish. Try again." + the size/type messages if `headObject` disagrees |
| G3 | `DELETE C/files/:fileId` | → `{ok}` | `PACKAGE_LOCKED`, `ALREADY_APPROVED` |
| G4 | `PUT C/rows/:rowKey/caption` | `{caption}` → row | `CAPTION_TOO_LONG` "Keep it under 500 characters." · `PACKAGE_LOCKED` |
| G5 | `POST C/submit` | `{round}` → G1 | `PACKAGE_INCOMPLETE` "Every deliverable needs its files before you can send this." · `ALREADY_SUBMITTED` "This is already with {Brand}." (stale `round` or already under review) |
| G6 | `POST B/approve` | `{round}` → G1 | `ALREADY_APPROVED` · `NOTHING_TO_REVIEW` "{Name} hasn't sent anything yet." |
| G7 | `POST B/changes` | `{round, reason, notes:[{fileId,note}]}` → G1 | `REASON_REQUIRED` "Say what should change." · `CAPTION_TOO_LONG`-style `REASON_TOO_LONG` "Keep it under 500 characters." · `ROUNDS_USED` "You've used {both / all n} rounds. Approve this, or report it to INFLX." (Q8) · `ALREADY_APPROVED` |
| G8 | `PUT C/proofs/:rowKey/:slot` / `DELETE` | `{url}` or `{screenshotFileId}` → row | `LINK_INVALID` "Paste the full link to the post." (https + the row's platform host, shape only, never fetched) · `NOT_APPROVED` "{Brand} haven't approved this yet." |
| G9 | `POST C/posted` | → G1 | `PROOF_INCOMPLETE` "Add a link for every deliverable first." · `ALREADY_POSTED` "You've already told them." |
| G10 | `POST B/confirm-live` | `{amount}` (echo of the T2 shown on the button) → G1 | `NOT_POSTED` "{Name} hasn't posted yet." · `ALREADY_CONFIRMED` "This is already confirmed." · `REPORTED_HOLD` "This is with INFLX now. Nothing moves until it is settled." (Q10) · `AMOUNT_CHANGED` "The amount changed. Check it and confirm again." |
| G11 | `POST B/report` (`rounds_used` \| `posted_wrong`), `POST C/report` (`brand_silent`) | `{kind, note?}` → G1 | `ALREADY_REPORTED` "You've already reported this." · `REPORT_TOO_EARLY` "You can tell INFLX from {date}." · `REPORT_NOT_OPEN` (wrong kind for the stage) |
| G12 | `GET B/files/:fileId/url`, `GET C/files/:fileId/url`, `GET /admin/collabs/:ciId/content/files/:fileId/url` | → `{url, expiresAt}` (300 s, logged) | 404 for anyone else; admin 404 unless `reported_at` set and the capability is held (Q12) |
| G13 | existing `GET/PUT /admin/platform-settings` | — | existing range checks |

**Money out of order** (the prompt's last row): any money action whose precondition isn't met refuses with a
stage-specific code above (`NOT_POSTED`, `ALREADY_CONFIRMED`, `REPORTED_HOLD`). J1 never refuses — it skips.
There is no endpoint that releases T3.

**Affected callers:** the brand website's review panel, inbox tab and CommandRail (retired to read-only); phone
`api.js` wrappers (deleted); `collabCounts`/`brandInbox`/`campaign.controller` readers (switched to
`collab_content`); `invitationRows.creatorCard` and set rows (a new `content` field for the doors).

---

## 10. The job lanes

**J1 — extend `tranche-3-release.job.js` (stays at `:00`).** Recommended over a second job so there is one
place that pays tranche 3. If the founder prefers a separate job, **`:10` is free**. Minutes in use: `:00, :05,
:13, :15, :20, :25, :30, :35, :40, :43, :45, :50, :55`. Item 11's note that `:15` was the last free minute is
wrong; offer-expiry runs there.

- Select `status='queued' AND trigger_event='day_30_post_live' AND COALESCE(release_due_at, triggered_at + live days) <= now()`. The fallback keeps the old rule for any row without a stamp; production has none queued.
- One transaction per row: `SELECT … FOR UPDATE SKIP LOCKED` → still `queued` → `processTrancheRelease` → `collab_content.t3_released_at/completed_at` (compare-and-swap `WHERE completed_at IS NULL`) → `ci.status='completed'` → campaign completion check. Notify both sides **after commit**, push + in-app, **no SMS** (today it texts, `:76`). Record `collab_events` `COMPLETE`.
- **Idempotency proof (tests):** run the job twice → one ledger row, one set of notifications; two concurrent runs (two connections) → one release; kill between the release and the notify → the next run releases nothing and the collaboration is Completed; changing `tranche_3_release_after_days` after G10 → the due date doesn't move (check 19).
- `release_due_at` = the IST calendar date of the confirmation + N days, at `tranche_3_release_time_ist` (03:00). "Arrives on 30 Oct" is then exact (Q5).

**J2a — Delayed, third arm** in `collab-delayed.job.js` (`:05`), `contentJobs.flagDelayedContent()`:
Pay for Content, both signed, shoot `completed`, `go_live_date < today`, `live_confirmed_at IS NULL`, and
**no report**. Stage from the state: nothing submitted → `content_not_submitted`; under review →
`content_in_review`; changes requested → `content_changes_requested`; approved, not posted →
`content_not_posted`; posted, not confirmed → `content_not_confirmed`. Same shape as items 10/11: select → lock
`SKIP LOCKED` → gate → compare-and-swap → notify both once after commit. Re-flagging is Q9.

**J2b — 48 h reminders, third arm** in `shoot-reminders.job.js` (`:55`), `contentJobs.remindContent()`
driven by `openContentMove(state)` (the same rule Needs You uses):

| Move | Side | Since |
|---|---|---|
| Send your content | creator | shoot done |
| Review the content | brand | latest submission |
| Make the changes | creator | latest verdict |
| Post it and add the links | creator | approval |
| Confirm it is live | brand | posted |

Anchor = the later of `reminder_sent_at` and `since`; wait 48 h; stamp after sending; stop when reported or
completed. Items 10/11 stop reminding at the posting date; here reminders **continue** past it (Q6 — §12.2 says
"no time limit… Needs You with reminders"; C16 says "reminded every two days"). Also sweeps unconfirmed uploads
older than 24 h.

**Proof of idempotency for J2:** run twice → one notification; `delayed_at` compare-and-swap; reminder anchor
test at 47 h / 49 h / 95 h / 97 h.

---

## 11. Frontend plan

**Where it attaches.** No new tab or navigator.

- **Creator:** a new `Content` screen on `CollabsStack` (`M/navigation/InfluencerNavigator.js:81-111`; name
  free). Doors: "Start uploading" in the done states of `ShootScreen` (`:132-161`) and `RemoteShootScreen`
  (`:199-241`); `CollabsScreen` routing (`:80-86`) prefers `item.content` once the shoot is done (a new
  `content` field on `invitationRows.creatorCard`).
- **Brand:** a new `BrandContent` on `CampaignsStack` (`M/navigation/BrandNavigator.js:104-133`; name free).
  Doors: `BrandSetDetailScreen` row tap, chip and ⋯ menu (`:106-128, 207-219`); "Open the content" in the done
  states of `BrandShootScreen` (`:169-213`) and `BrandRemoteScreen`.
- **Adjacent fix:** `BrandAgreementScreen`'s Remote button still toasts "arrives with item 11" (`M/components/shoot/copy10.js:85`, used at `BrandAgreementScreen.js:261-262`) — point it at `BrandRemote`.

**Per screen** (one screen per side driven by `stage` and `can`, like items 10/11):

| Screen | Built from | New |
|---|---|---|
| C1 / C2 opens | `StepLine10`, `Card7`, `GreenBox10` / `WaitBox10`, `day10`, deliverable labels `copy5.js:35-48` | `FeeCard12` (dot vocabulary from `bits10.js:256-263`), usage-rights line |
| C3 / C4 upload | `TextField4` (500 counter, `M/components/campaigns/bits4.js:46`), `PrimaryButton` disabled + hint | `RowBlock12` (label, "n of m" grey → green), `FileTile12` (duration badge), `AddTile12`, `UploadProgress12` |
| C5 send sheet | `Sheet` + item 11 sheet rules (`M/components/remote/sheets11.js:4-9`), `busy` | `SendSheet12` |
| C6 / C9 / C14 review | `RoundPill6` (`M/components/negotiation/bits6.js:16`), `AmberBox10`, `MoveBox10`, `PrimaryButton` | photo viewer (`<Image>` + signed URL), video → `Linking.openURL`, round-history list |
| C7 changes sheet | `Sheet`, `TextField4`, `FieldError` | per-file note pins (`NoteSheet12`) |
| C8 changes requested | `AmberBox10`, quoted reason | amber file-note chip |
| C10 posting | `TextField4` | `LinkField12` per slot, `ScreenshotTile12` |
| C11 confirm live | `MoneyMoved7` (`M/components/agreement/bits7.js:104`), `DangerButton`-style `busy`, quiet `TextButton` | `ConfirmLiveSheet12` (amount on the button), `ReportSheet12` |
| C12 / C13 paid / completed | `FeeCard12`, `Row10`, `StepLine10` | `RecordCard12` |
| C15 / C16 other states | `DelayedChip10`, `StateBox7`, `Skeleton`, **`LoadErrorList({what})`** (`M/components/discovery/DiscoverList.js:254`) — not `LoadError`, which says "your settings" | — |

**Components** live in `M/components/content/` (`bits12.js`, `copy12.js`, `sheets12.js`). Copy is
word-for-word with the server's messages and tested.

**The `busy` rule:** every sheet's confirm uses `busy`. `SecondaryButton`/`TextButton` ignore `disabled`
(`M/components/settings/primitives.js:147, 163`), so "Not yet"/"Back" must not be the thing that can
double-send.

**Picker / player / upload — plainly:**
- Gallery pick of photos and videos: **OTA-safe** (in the binary).
- Upload of 200 MB: **OTA-safe in principle** (streaming `{uri}` body), **must be proved on a device in 2b**.
- Showing a video inside the app: **not OTA-safe**. The OTA fallback is opening a short-lived signed URL in the
  phone's player/browser; the in-app player is a new APK (Q11).

**Brand website:** replace the review/confirm panel, inbox "Content reviews" tab and CommandRail prime action
with read-only content (§4). **Admin (C17):** no page change; two rows appear.

**Needs You on the phone:** nothing renders a Needs You list today (§24 deferred; the helpers are orphaned).
Item 12's Needs You is the backend counts (`GET /influencers/me/needs-you`, `GET /brands/me/inbox-summary`)
plus the "Your move" chip on the set row and Collabs card.

---

## 12. What items 14 and 15 will reuse

§12.1 runs the same chain after the shoppable post: **she names social deliverables → submits the social
version to the brand → brand approves → she posts → she confirms → brand confirms live**, and for Hybrid that
confirmation releases the remaining 75%.

| Piece | Reused as is | What 14/15 add |
|---|---|---|
| `collab_content` + rounds + files + captions + proofs | Yes. Rows come from a **source**: the agreement for Pay for Content, her named deliverables for 14/15. Keep row resolution behind one function (`contentRows(ci)`). | A `content_named_rows` table for her named deliverables. |
| Review, rounds, stamped limit, reports | Yes | — |
| Posting proof + "posted" + confirm live | Yes | — |
| `contentMoney.releaseSecond/releaseFinal` + J1 | Yes — Hybrid's T2/T3 are the same escrow rows | Hybrid calls `releaseSecond` from its confirmation. Pay for Sale calls nothing (no escrow). |
| Gate | `assertContentOpen` takes the Aim set as a parameter | 14/15 pass `conversion` / `hybrid`. |
| Delayed / reminders / Needs You | `openContentMove` | — |

**Not shared:** the shoppable post and INFLX's quality review (§31: separate review stages). Today a Hybrid
collaboration with no `deliverables` rows has no path to T2 at all; item 15 closes that through this service.

---

## 13. Test baseline and the tests to add

**Baseline:** full backend suite, serial, against a fresh `inflx_test` on `localhost:5544`, written to
`backend/baseline_item12.json` before any item 12 line. Compared later with
`node scripts/compare-tests.js baseline_item12.json after.json` (committed in item 11).

| | item 11 baseline | **item 12 baseline (25 Sep)** |
|---|---|---|
| Suites | 126 (52 failing) | **131 (46 failing)** |
| Tests | 1430 | **1545** |
| Passing | 1198 | **1323** |
| Failing | 232 | **220** |
| Skipped | 0 | **2** (item 11's retired `stage4-parcel` pair, in a `describe.skip` named for item 11) |

Against item 11's own final run (1325 / 218), **3 tests went red with no code change**, all in
`tests/item3b-pipeline.test.js` (checks 2–5, 14, 28, and the S1/S2/S3 card test). Each expects
`yt_uploads_90d: 7` / `yt_short_count: 4` and now gets 6 / 3. **Classification: stale fixture (date drift).**
A YouTube short with a fixed publish date has aged out of the rolling 90-day window. The code is unchanged and
the fixture needs a date relative to "today". They are part of the baseline, so item 12 will not be credited or
blamed for them. The fix belongs to whoever owns item 3b's fixtures, not item 12.

**Existing tests that touch this ground:** `tests/deliverables.test.js` (24 cases — will need a `describe`
block marked retired, item 11's pattern, never deleted), `deliverables-when-buying-content.test.js`,
`deliverables-model-aims.test.js`, `cron-tranche3.test.js` (its 20-day expectation assumes 30 days — stale
against 7), `admin-escrow.test.js`, `collab-spine.test.js`, `item7-agreement.test.js`, the item 10/11 suites
(gate, delayed, reminders), `escrow-fee-tiers.test.js`.

**To add:**
- **Backend:**
  - `item12-phase2a` — gate matrix × every route; the 8 legacy routes retired; the Store Visit `complete` branch retired; file privacy (404 for other brand, other creator, follower, admin without a report).
  - `item12-storage` — declared and real size/type; `headObject` mismatch deletes; the sweep.
  - `item12-package-review` — complete-or-nothing; lock; rounds stamped and unmoved by a setting change; last round; `ROUNDS_USED`; two taps → one round.
  - `item12-posting-money` — proofs, `posted`, confirm live; T2 exact; nothing deducted; `REPORTED_HOLD`; the before/after snapshot of check 21.
  - `item12-jobs` — J1 idempotency and stamped due; J2 stages and reminders.
- **Mobile:**
  - `content12.test.js` — components; copy matches the server.
  - `contentScreens.test.js` — every stage; loading, empty and couldn't-load; `busy`.
  - **A duplicate-`Stack.Screen`-name test for both navigators.** Nothing catches it today (`M/navigation/__tests__/item3Navigators.test.js:14-15` mocks the stack away).

---

## 14. Questions for the founder

Each has a recommendation; the §11 assumptions are Q15–Q29.

**Conflicts and decisions**

1. **The fee card numbers (rules vs mockups).** The mockups split ₹12,960 (fee + campaign fee) into 3,240 /
   3,240 / 6,480. The rules and production split the fee alone: ₹12,000 → 3,000 / 3,000 / 6,000. C16's
   "₹9,720 stays locked" is the same. *Recommend:* the rules win. Both fee cards show the creator's fee and its
   split. The brand's card adds one line, "INFLX campaign fee ₹960 · charged at signing". "Stays locked" shows
   the fee still in escrow (₹9,000 before T2, ₹6,000 after).
2. **Close the ungated legacy money door first (2a).** Retire all eight `/deliverables` write and read routes
   for **every Aim**, and turn the brand website panel read-only. *Recommend:* yes.
3. **Retire the Store Visit branch of the legacy "Mark visit done".** *Recommend:* yes, in 2a. Item 10's
   attended → confirm → auto-confirm covers it, and no production row is stuck.
4. **Where the final-payment waiting period lives.** C17 shows it on the Platform settings page. The code keeps
   it in `payment_config`, edited on the Payments page, with no audit and no range check. *Recommend:* move it
   into `platform_settings` as `final_payment_wait_days` (7, 1–60) with its audit. `tax.service` reads it from
   there, and the Payments page shows it read-only with a pointer. Stamp it at confirmation (Q5).
5. **The exact release moment for the final 50%.** *Recommend:* the IST date of the confirmation + N days, at
   the configured 03:00 IST release time, stamped on the tranche row. C12's "arrives on 30 Oct" is then exact.
6. **Reminders past the posting date.** Items 10/11 stop at the posting date. §12.2 says no time limit and C16
   says "reminded every two days". *Recommend:* content reminders continue every 48 h until the move is made,
   reported or completed.
7. **An agreement whose snapshot has no rows.** Possible when the creator row inherited set-level formats.
   Neither production Pay for Content collaboration is affected. *Recommend:* refuse the content step with
   "This agreement lists no content. INFLX will sort it out." and show it to Admin. Never fall back to live
   data, because §22 fixes the rows at signing.
8. **The rounds message.** "You've used both rounds" is fixed text, but the number is an Admin setting (1–5).
   *Recommend:* "You've used both rounds" when 2, "You've used all {n} rounds" otherwise, and the same logic for
   C7's "You have {n} rounds". The round pill follows `current_round` of `rounds_allowed`, with "· LAST" on the
   last one. From submission `rounds_allowed + 1` onwards it shows ROUNDS USED (C14).
9. **Delayed after a shoot-stage flag.** Asha's `d3fde0dc…` is already Delayed at `address_not_sent`. When her
   content then sits in review past the posting date, the stored stage would be stale. *Recommend:* notify only
   once (unchanged), but let the job **update `delayed_stage` silently** as the collaboration moves. G1 always
   shows the current stage. C16's "Where it stopped: in review with you" is then true.
10. **What a report freezes.** *Recommend:*
    - A brand report (`rounds_used`, `posted_wrong`) freezes the step: every write returns `REPORTED_HOLD`
      until item 18. No money moves, and the remaining 75% (or 50%) stays locked.
    - Her `brand_silent` report does **not** stop the brand confirming live. Confirming still pays her; the
      report stays recorded for item 18.
11. **Video playback.** *Recommend:* item 12 opens videos through a 300 s signed URL in the phone's own
    player/browser (OTA, proven pattern). An in-app player (`react-native-video`, new APK) goes on the next APK
    build list rather than blocking item 12. Photos show in the app.
12. **Admin's view of content for a dispute — now or item 18?** *Recommend:* now, only the G12 admin
    file-URL endpoint (behind a capability, only once reported). The admin screen that lists reports is item
    18's. Q12b: create one `collab_reports` table now so item 18 reads one place? *Recommend:* **no** — record
    on `collab_content` + `collab_events`, as item 11 recorded on `production_events`; item 18 unifies.
13. **Admin manual escrow release** can pay any tranche with a console-only reason. *Recommend:* keep it for
    item 18, but in item 12 write an audit row and refuse `disputed`/`refunded` rows. It stays the only manual
    money door.
14. **The adjacent money fixes** (§3.5: false low-wallet SMS, "pending" hiding a queued T3, "still locked"
    showing the campaign fee, T3 completion lost on a notification error). *Recommend:* fix all four in item 12,
    because item 12's states are what expose them. The `escrow.created_at` read and the campaign-cancel enum
    bug go to separate tasks.

**The §11 assumptions** (all recommended **yes** unless noted)

15. The completed shoot is the only door, for both modes, and Pay for Content is the only Aim. Test =
    `production_events.status='completed'`; Aim = `campaign_sets.goal='engagement'`.
16. What she owes is fixed at signing: rows of type (which implies the platform) and count, from `terms_json`,
    never editable.
17. Photos ≤ 10 MB (JPG/PNG), videos ≤ 200 MB (MP4), ≤ 10 files a row, caption ≤ 500, all on the server. Also a
    DB CHECK. *Also:* a **minimum** per row is the count; a per-file note ≤ 300 (rules give no number).
18. One complete package; an incomplete one is refused.
19. Submitting locks it; a change request reopens it; every round is kept, frozen in `package_json`.
20. One verdict per package; a required reason (≤ 500) on a change request; per-file notes optional.
21. Rounds stamped at her first submission; the last round warned; no third round — approve or report.
22. Approval locks the content; nothing can change after it.
23. A link per deliverable (count slots per row) and a screenshot per Story slot; then her confirmation. *Also:*
    the link must be `https` on the row's platform host (instagram.com; youtube.com or youtu.be); shape only,
    never fetched.
24. No auto-confirm of "live"; after the stamped silence days she may report.
25. Confirming live releases the second 25% and stamps the wait; the final 50% follows by job and completes.
26. Nothing is re-checked in the waiting period.
27. Item 12 moves those two payments and nothing else, with nothing deducted.
28. Files are private to the two parties, and to Admin only once reported.
29. Disputes are recorded here and handled in item 18.

**Also asked**

30. **A linked post deleted before the final 50%** — *recommend:* nothing happens (§12.2: governed by the
    usage terms, not a further check).
31. **Existing production collaborations in an unexpected state** — none. Both show "Shoot not done yet"; no
    backfill.
32. **Governance:** item 12 needs its contract `features/item12-content/` (spec, workflow, expected outputs,
    locked mockups copied into `04-preview/`) before Phase 2 code. *Recommend:* create it at approval, with the
    29 checks of §12.1 as `03-expected-outputs.md`.

---

*Stop. Waiting for approval before Phase 2.*
