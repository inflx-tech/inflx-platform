# Phase A — Golden-Journey E2E Results (2026-06-10)

> Run on LOCAL backend (:3001) + dev Postgres (:5433, Docker `inflx-dev-pg`),
> all external services mocked. Driver: `backend/scripts/journey-phase-a.js`
> (4 iterations; runs 1–3 failures were classified per QA governance —
> test-data drift fixed, genuine defects kept RED). Final ledger below is run 4.
> Companion: `Docs/USER_JOURNEY_MAP.md`.

## Final ledger — 25 PASS / 1 INFO / 1 FAIL

| Step | Result | What was proven (DB-asserted) |
|---|---|---|
| S1.1–S1.5 | PASS | OTP auth, brand+influencer registration, pending-gate blocks campaign create (ACCOUNT_PENDING), admin approve flips status, Apify mock claim flow |
| S2.1–S2.4 | PASS | Fashion tree (195 leaves, after seed), drill-once batch product + auto-SKU `JOUR-0001`, offer library create, wallet top-up ₹50,000 exact |
| S3.1–S3.2 | PASS | Campaign + hybrid set (set_budget + coupon + commission), handpick invite, publish → active/invited |
| S4.1–S4.3 | PASS | Inbox w/ 48h expiry, negotiation (counter ₹2500, WRONG_TURN enforced, brand accept), both-sign → brand wallet 50,000→47,300 (lock 2500×1.08), 3 escrow tranches, **T1 ₹625 released, influencer credited ₹606.25** |
| S5.1–S5.2 | PASS | submit → revision(1/2) → approve → live → confirm-live → **T2 released**, CI active; share-link `/s/{handle}` 302 + click log |
| S6.1–S6.8 | PASS (1 INFO) | Follower auto-approve; store page; **pay-at-store with all 4 attribution IDs + ₹40 commission + ₹40 marketplace fee**; online order E2E + visible in activity; enquiry lead; prebook table booking. INFO: offers section feed empty in dev (SECTION_ENGINE_OFFERS flag/dev data — prod renders offers) |
| S7.1, S7.3 | PASS | Commission cron moved ₹89.96 pending→wallet after window; withdrawal ₹200 → TDS ₹20 → net ₹180 via RazorpayX mock |
| **S7.2** | **FAIL — GENUINE DEFECT** | see below |

## Defects found by Phase A

### D1 (CRITICAL, NEW) — Tranche 3 never auto-releases in production
Nothing in the codebase flips the T3 escrow entry to `queued` or stamps
`triggered_at` when content goes live. After confirm-live, T3 sits
`status=locked, triggered_at=null` forever. The cron
(`jobs/tranche-3-release.job.js:39-47`) selects only
`status='queued' AND triggered_at <= now()-30d` → **never matches**.
Proven: manually setting `queued + triggered_at-31d` made the same cron release
₹1,212.50 and complete the campaign — so the release path is fine; the
**hand-off at content-live is missing** (likely belongs in
`deliverable.controller.js confirmLive` when all deliverables go live, next to
the T2 release). Consequence: influencers never get their final 50%;
campaigns never auto-complete. Verify in prod: `SELECT count(*) FROM
escrow_entries WHERE tranche_number=3 AND status='released'`.

### D2 (HIGH, CONFIRMED) — Unverified online order leaves zero DB trace
S6.5: order created via POST /follower/orders exists only in server memory
until /orders/verify fires. Skipping verify (network drop / app killed at the
payment sheet) = order silently gone, nothing to recover or show the user.
Confirms the missing-order diagnosis from 2026-06-10.

### D3 (MEDIUM, NEW) — Set creation accepts invalid deliverable format types
Run-1 evidence: `formats_json:[{type:'instagram_reel'}]` accepted at
`POST /campaigns/:id/sets`, then exploded 3 stages later at brand-sign as a
500 (`invalid input value for enum deliverable_type`). Set create should
validate format types against the enum at write time.

### Dev-environment notes (not prod defects)
- Fashion/furniture taxonomy lives in `backend/scripts/seed-*-taxonomy.js`,
  not migrations — fresh dev DB has an EMPTY tree until run.
- `scripts/seed.js` superadmin phone `+919000000001` collides with demo
  influencer from migration 003 → seed fails; created admin via SQL
  (`+919000000099`).
- OTP rate limiter trips after ~3 full journey runs from one IP (correct
  behaviour; restart backend to clear in dev).
- Influencer withdrawal requires UPI on file first — set via
  `PATCH /influencers/me {upi_id}` (works).

## FIX STATUS (same day, 2026-06-10)

All three defects FIXED, verified, awaiting founder deploy go:
- **D1** → `features/backend-defect-tranche3-never-queued` — confirmLive arms
  T3 in the same transaction as the T2 release; migration 097 backfills stuck
  prod rows (clock from T2's release date). Journey run 5: T3 queued naturally,
  cron released it E2E.
- **D2** → `features/backend-defect-pending-order-volatile-store` — durable
  `payment_pending_orders` (migration 098); peek + atomic-claim-in-transaction
  across all 5 verify paths. Unverified orders persist; failed verifies
  retryable; deploys no longer wipe in-flight checkouts.
- **D3** → `features/backend-defect-set-format-enum-validation` —
  formats_json validated against the deliverable_type enum at set create/update.

Regression: journey driver **27 PASS / 0 FAIL** + `pnpm qa` **79/79 GREEN
STATE=GREEN gate=0**. Prod sequence: `run-098.js` → `run-097.js` → git push
(Render auto-deploy). Backend-only; no OTA.

## What Phase A cannot see (→ Phase B, founder on device)
Share-link deep-link INTO the app (attribution survival), section-engine
rendering on real screens, real Razorpay sheet, OTA-served screens, and the
known frontend bugs (offer-tap 404, salon copy, blank chips) which live in
app code, not the API.
