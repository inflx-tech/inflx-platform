# Item 12 — Pay for Content: build summary

In the order the approval asked for (§4.2). Contract `features/item12-content`.

**Deploy state:** Phases 2a + 2b are LIVE (migration 192 applied, `c23d8634` pushed, OTA influencer
218) — the founder's go of 25 Sep. Phases 2c + 3 + 4 (`1911c640`, `0182686e`, and the Phase 4
record) are committed locally and **not pushed**: no content screen is on any phone yet, and no
content endpoint beyond the file routes is live. **No money has moved anywhere.**

---

## 1. The three findings, and what each now does

**1 · Money could leave for Pay for Content through a door nobody guarded.**
`POST /v1/deliverables/:id/confirm-live` released tranche 2 and queued tranche 3 with no signature,
no shoot and no Aim check, and the brand website called it; both production Pay for Content
collaborations already had the rows it needed.
**Now:** all eight `/v1/deliverables` content routes answer `RETIRED_12_*` for every Aim (proved by a
loop, one case per Aim, and not one rupee moves — check 32). The controller that held the unguarded
release is deleted; the legacy rows are kept and unread. The only way to release tranche 2 is the
brand's confirmation behind the content gate, through `contentMoney`.

**2 · The final-payment wait was read live on every job run**, so changing the number would move a
date already promised.
**Now:** the wait is `platform_settings.final_payment_wait_days` (moved from `payment_config`, with
its audit), and it is **stamped** on the tranche-3 row as `release_due_at` at the brand's
confirmation — the IST day + N at the 03:00 release time. The job pays on the stamp. Changing the
number moves nothing already confirmed (check 33).

**3 · The mockups split ₹12,960 — the fee plus the campaign fee — when the rules split the fee alone.**
**Now:** her card, her split and every release are her fee alone (₹12,000 → 3,000 / 3,000 / 6,000);
the campaign fee is its own line on the brand's card only; "still locked" is her fee in escrow,
from the escrow rows (₹9,000 → ₹6,000 → ₹0), never `locked − released` (checks 30, 31).

---

## 2. The money

**Every path that can release a tranche**

| Path | Before item 12 | After |
|---|---|---|
| The brand's signature → T1 | item 9, correct | unchanged |
| `POST /deliverables/:id/confirm-live` → T2 + queue T3 | **live, ungated** | **retired** (`RETIRED_12_CONFIRM_LIVE`) |
| `POST /content/confirm-live` (G10) → T2 + stamped T3 | — | the brand's confirmation, behind the gate; escrow `FOR UPDATE`; compare-and-swap; refuses an ended or brand-reported collaboration; the amount named on the button must match |
| `tranche-3-release.job` → T3 | live number, no row lock, SMS, completion outside the release | stamped due; `FOR UPDATE SKIP LOCKED`; completion **inside** the release transaction; held under a brand report; push + in-app, no SMS |
| `POST /admin/escrow/:id/release` | any tranche, reason to the console | required reason stored in `escrow_manual_releases`; refuses `disputed` / `refunded` |

**Only two releases in item 12, nothing deducted — check 21's snapshot.** One complete run
(₹12,000 fee), shoot done → Completed:

| | Before | After |
|---|---|---|
| Brand wallet | x | **x** (untouched) |
| `contracts.locked / released / campaign_fee` | 12,960 / 3,000 / 960 | **identical** |
| Her wallet / total earned | y | **y + 9,000** (3,000 + 6,000, in full) |
| Escrow | T1 released · T2 locked · T3 locked | **all released** — 3,000 / 3,000 / 6,000 |
| Her ledger | — | **+2 rows**: `tranche_release` 3,000 and 6,000 |
| Brand `wallet_transactions` | — | **+4 audit rows only**: `escrow_release` + `payout` × 2, at an unchanged balance |

Production after the 2a+2b deploy: escrow ₹34,500 (T1 released × 4, T2 locked × 4, T3 locked × 4),
contracts locked ₹36,260, released ₹8,625, creator wallets ₹8,625 — identical before and after.

## 3. What was retired, in order

1. **The eight `/deliverables` routes** (read, upload-url, media-url, submit, review, bulk-review,
   submit-live, confirm-live) — every Aim; `refresh-stats` kept.
2. **The Store Visit branch of `POST /production-events/:id/complete`** (`RETIRED_12_COMPLETE_VISIT`).
3. **The website panels:** Approve / Request revision / "Confirm live · release T2", the content
   preview, the inbox Content reviews list, the CommandRail review prime actions, the CONTENT counts
   tile, "Mark visit done" → read-only ("Content is reviewed and confirmed in the app").
4. **The legacy notification keys** `deliverable.*` — nothing sends them any more; `content.*`
   replaces them (no SMS). The tranche-3 job's SMS is gone.
5. **The phone's wrappers** for the eight routes and `complete`.
6. The Payments page's editable T3 wait → read-only with a pointer.

## 4. Storage

Private R2 objects under `collab-content/<ciId>/`. The server signs a PUT with **Content-Length and
Content-Type both signed**; the phone streams the file (`{ uri }` body — never a Blob in memory,
45-minute timeout); `confirm` asks storage what landed (`head`) and deletes it on any mismatch; views
are 300-second signed GETs to the owning brand (only what she sent), her, and Admin once reported.
Never `putBuffer`, `brand_media_assets` or `/uploads`. A 24-hour sweep deletes an unconfirmed orphan
and never a file a round references.

**The device result, plainly:** a **194.9 MB MP4 (204,360,095 bytes)** uploaded from the founder's
own Android phone to **production R2**, twice (1 m 17 s and 1 m 46 s), verified byte for byte and
type by `head`, and deleted. A URL signed one byte short was refused by R2 (403) on a 14 MB file; on
195 MB R2 refuses by cutting the connection mid-upload — also refused, nothing kept. (The founder's
first 14 / 18 MB results were WhatsApp-forwarded copies — WhatsApp recompresses video.)

## 5. The Admin numbers

| Number | Where | Stamped |
|---|---|---|
| Content change requests (2, 1–5) | `platform_settings.content_change_rounds` | `collab_content.rounds_allowed`, at her first submission |
| Brand silence before she may report (7, 1–30) | `platform_settings.content_report_silence_days` | `report_silence_days` / `report_after_at`, when she confirms she posted |
| Final payment waiting period (7, 1–60) | `platform_settings.final_payment_wait_days` (moved) | `escrow_entries.release_due_at` + `collab_content.final_wait_days`, at the brand's confirmation |

`payment_config.tranche_3_release_after_days` is now **unread and left in place**. The Platform
settings page draws all three with no page change.

## 6. Test results

Backend, full suite, serial, against `baseline_item12.json`:

```
suites          131 (46 failed)  ->  135 (46 failed)
tests           1545             ->  1620
passed          1323             ->  1372
failed          220              ->  220
newly failing   0
new             101  (101 green)
gone            26   (all renamed into skip blocks named for item 12 — none deleted)
newly passing   0
```

- **The retired `deliverables` describe blocks:** the four `POST /v1/deliverables/:id/*` blocks
  (24 tests) are kept whole in `describe.skip` named `[RETIRED by item 12 …]`, replaced by
  `item12-phase2a` check 32; item 11's §2.9 test and stage4's "complete is retired for REMOTE ONLY"
  likewise, each with an executing replacement.
- **Assertion drift, each updated with the rule that moved it:** item 7 "still locked" ×2 (Q1),
  item 10 Delayed count (the content arm), item 11 "the return lane never delays" (the content
  lane flags it, the Remote lane still flags nothing), cron-tranche3 (it only passed on a 30-day
  fallback), item 6's settings list (C17).
- **The item 3b date-drift note, carried over:** three `item3b-pipeline` tests went red before
  item 12 wrote a line — a YouTube fixture with a fixed date aged out of the 90-day window. They are
  in the baseline and still failing; nothing in item 12 touches them.
- Item 12's own: backend `item12-phase2a` 18, `item12-storage` 19, `item12-flow` 24, `item12-jobs`
  13 — all green. Mobile 58 suites / 715 tests green, of which item 12's 35.
- Governance check: OK.

## 7. Checks 1–46

**46 / 46 pass** — each with the test that proves it in `features/item12-content/03-expected-outputs.md`.
Check 45's device half is the founder's run above.

## 8. Handover notes

- **`react-native-video` for the next APK** — videos open in the phone's own player until then.
- **The `escrow.created_at` read** (`GET /brands/me/campaigns/:id/escrow`) — its own task.
- **The full campaign-cancel refund fix** — its own task. Item 12 added only the guard (a queued
  tranche blocks the cancel, before the draft shortcut — 6 "draft" campaigns in production hold 7
  signed collaborations).
- **`CONTENT_UPLOAD_PROBE`** must be off on Render (the founder removes it after the device run).
- **What items 14 and 15 inherit:** `collab_content` and its rounds, files, captions, proofs and
  reports; `contentFlow` (rows come from a source — the agreement here, her named deliverables
  there); `contentMoney.releaseSecond / releaseFinal` (Hybrid's T2/T3 are the same escrow rows);
  `contentGate` (the Aim is the only thing to widen); `openContentMove` / `CONTENT_MOVE_SQL`; the
  Delayed arm and reminder lane; the storage path; the phone's `uploadContentFile`, bits and sheets.
- **For item 18:** reports are on `collab_content` (`brand_reported_*`, `creator_reported_*`) plus a
  `collab_events` row; Admin's file view opens once a report exists.
- **A product question left for later:** a creator who uploads a WhatsApp-forwarded copy gives the
  brand a recompressed file. The locked mockups carry no hint about it; it is not added.
