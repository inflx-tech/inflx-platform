# INFLX Revenue Model — Wave 2 Handoff (2026-05-28)

> Self-contained handoff for the next Code-builder window. Picks up
> mid-Wave-2 of the platform-finance hardening initiative. Read this
> FIRST, then verify baseline, then continue.

═══════════════════════════════════════════════════════════════════
## 0. READ FIRST — context this handoff assumes
═══════════════════════════════════════════════════════════════════

- Auto-memory: `C:\Users\aveen\.claude\projects\C--WORK\memory\MEMORY.md`
  + all topic files (verify-twice, deploy-cadence, qa-governance,
  comms-cadence, contract-driven workflow, etc).
- Repo charter: `C:\WORK\inflx-platform\GOVERNANCE.md` + `CLAUDE.md`
  (always-injected) + `LOCAL.md`.
- The full revenue audit + this Wave plan was produced in the prior
  session (the chat that created this doc). The audit compared the
  founder's documented money-flow spec against the codebase and found
  the gaps Waves 2/3/4 close.

═══════════════════════════════════════════════════════════════════
## 1. WORKING ENVIRONMENT (unchanged from prior handoffs)
═══════════════════════════════════════════════════════════════════

- Bash cwd defaults to `C:\WORK`. EVERY shell cmd needs
  `cd /c/WORK/inflx-platform &&` prefix. Dedicated tools (Read/Write/
  Edit/Grep/Glob) take absolute paths.
- Local dev DB: `localhost:5433/inflx_dev` (backend/.env).
- Test DB: `localhost:5544/inflx_test` (qa:db spins it).
- Supabase prod: connection string in `backend/.env.prod-backup`
  (gitignored, never commit).
- `RAZORPAY_MOCK=false` on Render (live Razorpay test-mode flow is
  active on prod). Local `.env` keeps `RAZORPAY_MOCK=true`.
- **Prod migration safe-apply (trap+restore, single bash invocation):**
  ```bash
  cd /c/WORK/inflx-platform && \
  cp backend/.env backend/.env.bak && \
  cp backend/.env.prod-backup backend/.env && \
  trap 'cp backend/.env.bak backend/.env && rm -f backend/.env.bak && echo "[restore] local .env restored"' EXIT && \
  node backend/scripts/run-NNN.js
  ```
  ⚠ GOTCHA: do NOT `cd backend` inside the trap'd command — the trap's
  relative `backend/.env.bak` path breaks if cwd changed. Keep cwd at
  repo root; reference `backend/scripts/run-NNN.js`. If the trap fails,
  manually `cp backend/.env.bak backend/.env && rm backend/.env.bak`
  and verify DATABASE_URL is localhost:5433.
- `pnpm qa` (main lane) must be GREEN before any push: STATE=GREEN
  gate=0, 76/76. Run from repo root (`cd /c/WORK/inflx-platform &&
  pnpm qa`). qa:db is decoupled/informational.

═══════════════════════════════════════════════════════════════════
## 2. BASELINE AT THIS HANDOFF
═══════════════════════════════════════════════════════════════════

- **origin/main HEAD = `0c69264`** (Wave 2 commit 1).
- Latest migration on disk + applied to prod: **M074**. Next = **M075**.
- Window B (parallel agent) is doing follower-app redesign (Flow 38+,
  commits `feat(redesign): Flow NN — ...`). They push to main too.
  ALWAYS `git fetch origin` before push if there's been a gap; they
  don't touch backend/src/** or revenue paths. Rebase silently.
- First actions:
  1. `cd /c/WORK/inflx-platform && git fetch origin && git log --oneline origin/main -10`
  2. `cd /c/WORK/inflx-platform/backend && node -e "require('./src/app'); console.log('app loaded OK')"`
  3. `cd /c/WORK/inflx-platform && grep -E "^DATABASE_URL" backend/.env | sed 's/:[^:@]*@/:***@/'` → confirm localhost:5433.

═══════════════════════════════════════════════════════════════════
## 3. WHAT SHIPPED IN THE PRIOR SESSION (all on prod)
═══════════════════════════════════════════════════════════════════

Per-feature catalog + revenue rollout — ALL LIVE on Supabase prod:

| Phase | Commit(s) | Migration |
|-------|-----------|-----------|
| A12.5 open_group_broadcast + bulk_outreach wiring fix | 1b2f1f2, cbad4ce | M065+M066 ✅ |
| A12.6 multi_branch_support gate | 69f70a4, 0d4db25 | M067 ✅ |
| A12.7 support-tier informational flips | b54b94c, a4fdd86 | M068 ✅ |
| A14 per-brand feature overrides | 0acc4e7, ea0a402 | M069 ✅ |
| UI polish (QuotaWallModal + useEntitlements + Add-Branch hide) | 6abcc93, 9981c80 | — |
| A6.5/A13 Razorpay live subscriptions + UPI Autopay | 03f0401, 22d4ed2 | M070 ✅ |
| defect: pending_mandate enum | d39c5f6, 331797e | M071 ✅ |
| defect: cycle dates on INSERT | 8c7163e | — |
| defect: webhook body hang (express.raw) | 7a28438 | — |
| defect: webhook signature diagnostic logging | 14406ab | — |
| trust proxy (Render) | 153c85b | — |
| **Wave 1 commit 1** tax-config foundation | c2a060d, 15253de | **M072+M073+M074 ✅** |
| **Wave 1 commit 2a** admin UI for L3 category rates + return window | 34b1b6e | — |
| **Wave 1 commit 2b** admin UI for tax/identity/per-actor controls | 2acd2d6 | — |
| **Wave 2 commit 1** wallet 3-state breakdown | 0c69264 | — |

**Razorpay test-mode is fully working end-to-end.** Test brand "Aveen
food paradise" (phone +91 9000000061) is on Growth Monthly (active),
₹2,499 charged, paid invoice written. The 3 monthly plan_ids are
pasted in admin (`/admin/pricing/tiers/[tier_key]` Section B):
- Growth Monthly = `plan_StzITKolhQqZXu`
- Pro Monthly = `plan_StzJqcecbSDoBQ`
- Enterprise Monthly = `plan_StzKmfWYCUgQJ4`
Razorpay webhook configured at
`https://inflx-platform.onrender.com/v1/webhooks/razorpay`, secret
rotated to a fresh value matching Render's `RAZORPAY_WEBHOOK_SECRET`.
**Yearly plan_ids NOT yet created** — yearly upgrade returns 422
ADMIN_CONFIG_MISSING until founder creates 3 yearly plans on Razorpay
+ pastes their IDs. Yearly prices ARE seeded on prod (Growth ₹23,991 /
Pro ₹96,000 / Enterprise ₹2,88,000).

═══════════════════════════════════════════════════════════════════
## 4. WAVE 1 — what admin can now control (all live)
═══════════════════════════════════════════════════════════════════

M072 added to `payment_config`: `gst_pct` (18), `tcs_pct` (1),
`tcs_active` (false), `tcs_active_from_date`, `platform_gstin`,
`platform_business_name`, `platform_business_address`,
`platform_state_code`, `invoice_prefix_subscription` (INF-SUB),
`invoice_prefix_commerce` (INF-COM).
M073 added: `categories.return_window_days` (30),
`influencers.tds_override_pct` + `tds_exempt` (false),
`brands.commerce_commission_override_pct`.
M074 added: `payment_config.tranche_3_release_time_ist` (03:00:00) +
`tranche_3_release_after_days` (verify exact column name in M074 — it
governs T3 day offset).

Backend now reads all of these (with `?? default` fallbacks) in:
- `subscription.controller.js` + `webhook.controller.js` → GST from
  `payment_config.gst_pct` (no longer hardcoded 18).
- `withdrawal.service.js` → TDS = `tds_exempt ? 0 : (tds_override_pct
  ?? payment_config.tds_pct)`.
- `pricing.service.js` → per-brand commerce override + per-category
  return window.
- `escrow.service.js` / T3 cron → release time-of-day from config.

Admin UI surfaces (all live):
- `/admin/settings/payments` — GST, TCS toggle+date, T3 time, platform
  identity, invoice prefixes (the "Tax & Identity" section).
- `/admin/pricing/categories` — per-category L3 rates (path a/b/c) +
  return window.
- `/admin/brands/[id]` — L3 commerce commission override card.
- `/admin/influencers/[id]` — TDS Controls (override % + exempt toggle).

New admin endpoints: `PATCH /admin/brands/:id/commerce-commission-override`
+ `PATCH /admin/influencers/:id/tax-controls` (both finance+).

═══════════════════════════════════════════════════════════════════
## 5. SETTLED DESIGN DECISIONS (locked with founder — do NOT re-ask)
═══════════════════════════════════════════════════════════════════

1. **Mid-cycle upgrade = Option A (pro-rata difference).** Brand pays
   `(newDailyRate − oldDailyRate) × daysRemaining + GST`. New cycle
   ends at the ORIGINAL cycle's end date (cycle dates stay aligned).
   Implement via a one-off Razorpay Order for the delta + cancel-old-
   subscription + create-new-subscription with `start_at` = old cycle
   end. Downgrades = schedule at next cycle end (out of scope for now).
2. **GST on Protection Fee = EXCLUSIVE display.** Brand sees fee +
   GST as separate lines (so they can claim input credit). Platform
   books clean: fee = revenue, GST = collected.
3. **TCS = deducted from the BRAND's portion** (legally correct,
   Sec 52 CGST). Customer pays full; platform deducts TCS from brand's
   settlement; deposits to govt monthly. Keep `tcs_active` toggle OFF
   until founder crosses ₹50L threshold + CA signs off.
4. **T3 timing = days + time-of-day, T3 ONLY.** T1 fires immediately
   on contract sign; T2 is event-driven (content_live); only T3 has
   the admin day-offset + time-of-day controls. (M074 shipped this.)

Founder confirmed: only ONE engagement fee exists ("Protection Fee" =
"Campaign Assurance Fee" — same thing, two names). In code it's
`escrow_fee` / `escrow_fee_amount`.

═══════════════════════════════════════════════════════════════════
## 6. WAVE 2 — REMAINING WORK (commits 2-4)
═══════════════════════════════════════════════════════════════════

Wave 2 commit 1 (wallet 3-state breakdown) is DONE (0c69264). Three
commits remain. ALL move real money — verify-twice carefully.

### Commit 2 — Brand wallet withdrawal (the priority)
- **M075**: new `brand_withdrawals` table (mirror `influencer_withdrawals`
  schema: id, brand_id, amount_requested, method upi|bank_transfer,
  upi_id, bank fields, razorpay_payout_id, status enum
  pending|queued|processing|completed|failed|cancelled, failure_reason,
  timestamps). Index on (brand_id, status).
- New endpoint `POST /v1/brands/me/wallet/withdraw` — validates amount
  ≤ available_balance (the live `brands.wallet_balance`); creates a
  brand_withdrawals row; calls RazorpayX payout.
- Reuse `withdrawal.service.js` `createRazorpayPayout` pattern (it
  already hits `POST https://api.razorpay.com/v1/payouts` with UPI/
  bank). Add a brand variant or generalize.
- Admin queue: `/admin/withdrawals` → add a "Brand" tab alongside the
  existing influencer tab; mirror `getWithdrawals`/`processWithdrawal`.
- Brand UI: `/dashboard/wallet/withdraw` (or a section on the wallet
  page) — form for amount + UPI/bank.
- Decrement `brands.wallet_balance` + write a `wallet_transactions`
  row (type='payout' direction='debit') on successful payout so the
  3-state breakdown stays correct.

### Commit 3 — L2 GST on Protection Fee
- **M076**: `ALTER TABLE escrow_entries ADD COLUMN fee_gst_amount
  numeric(10,2)`.
- In `escrow.service.js` at tranche-release / fee-capture: compute
  `fee_gst_amount = fee_amount × payment_config.gst_pct / 100`
  (EXCLUSIVE per decision 2). Persist alongside `escrow_fee_amount`.
- Surface both lines (fee + GST) in the brand-facing tranche/escrow
  statement UI.
- Use a centralized helper — there may already be a `tax.service.js`
  from Wave 1 commit 1; verify and reuse `gstOn(amount)`.

### Commit 4 — Mid-cycle upgrade pro-ration (Option A)
- `subscription.controller.upgrade`: when brand has an active
  subscription AND requested tier price > current:
  - compute delta via `(newDailyRate − oldDailyRate) × daysRemaining`
  - `delta_gst = delta × gst_pct/100`
  - create a one-off Razorpay **Order** (not subscription) for
    `delta + delta_gst`
  - return `{ status: 'proration_pending', razorpay_order_id,
    razorpay_key_id, delta_breakdown }`
  - frontend opens Razorpay Checkout in ORDER mode (different from the
    subscription mode used today)
  - on `order.paid`/`payment.captured` webhook → cancel old Razorpay
    subscription + create new one with `start_at` = old cycle end +
    update brand_subscriptions (cancel old row, INSERT new at new tier
    with original cycle end-date) + write a proration invoice with GST.
- ⚠ This is the trickiest Razorpay flow. Test thoroughly on test mode
  with Aveen (already on Growth Monthly) → upgrade to Pro Monthly.

**Migrations M075 + M076 surface together at end for ONE combined prod
go** (founder's hard carve-out: prod migrations always need explicit go).

═══════════════════════════════════════════════════════════════════
## 7. WAVE 3 — Commerce settlement (deferred, ~2 days, biggest)
═══════════════════════════════════════════════════════════════════

The BLOCKER from the audit: commerce purchases never settle to brands.
Needs Razorpay Route (founder must enable it on the Razorpay account —
confirm before starting). Scope:
- **M0NN**: `brands.razorpay_linked_account_id` + `linked_account_status`;
  `follower_transactions.tcs_amount` + `commission_gst_amount` +
  `commission_releasable_at` + `razorpay_transfer_id`.
- New `razorpayRoute.service.js` (createLinkedAccount, createTransfer).
- `transaction.controller` at purchase verify: compute commission GST
  + TCS (from brand portion, gated by `tcs_active`), post Route transfer
  to brand's linked account for `brand_net − tcs`, HOLD influencer
  commission with `commission_releasable_at = now() + category.return_window_days`.
- New cron `pending-commission-release.job.js` (hourly): move held
  commission from `influencers.pending_balance` → `wallet_balance`
  when `commission_releasable_at <= now()`.
- Brand UI `/dashboard/settings/payouts` — linked-account onboarding.
- Per-brand L3 override already wired (Wave 1); per-category return
  window already wired (Wave 1).

═══════════════════════════════════════════════════════════════════
## 8. WAVE 4 — Compliance reporting (optional/later, ~1 day)
═══════════════════════════════════════════════════════════════════

- Subscription invoice PDF generator (column `invoice_pdf_r2_key`
  exists; no generator wired).
- Commerce invoice PDFs (brand as seller-of-record, brand GSTIN).
- Monthly tax-summary admin report (GST collected / TCS owed / TDS
  withheld) for filing returns.

═══════════════════════════════════════════════════════════════════
## 9. GOTCHAS LEARNED THIS SESSION (carry forward)
═══════════════════════════════════════════════════════════════════

- **Webhook raw body**: `/v1/webhooks/razorpay` MUST bypass the global
  `express.json()` and use `express.raw()` — the old custom
  captureRawBody hung the handler (body already drained). app.js now
  conditionally skips json for `/v1/webhooks/*`. Don't revert.
- **Webhook signature**: editing a Razorpay webhook's Secret field
  shows it EMPTY; saving without re-typing keeps the OLD secret. To
  rotate cleanly, type a fresh value into BOTH Razorpay AND Render
  `RAZORPAY_WEBHOOK_SECRET`. There's a diagnostic log on mismatch
  (`[WEBHOOK] Signature mismatch debug:`) showing secret_len +
  first chars + expected/received sig prefixes — use it.
- **subscription_status enum** needed `pending_mandate` added (M071).
  brand_subscriptions has NOT-NULL `current_cycle_start`/`_end` — any
  INSERT must populate them (the cycle-dates defect).
- **trap+restore cwd bug**: see §1. Don't `cd backend` inside the
  trapped command.
- **Render redeploy ~2-3 min** after push. Code that reads a new
  column should `?? default` so push-before-migrate is safe (forward-
  only, zero-downtime pattern used throughout Wave 1).
- **LF→CRLF git warnings** on every add — normal on Windows, ignore.
- pnpm qa stayed 76/76 GREEN across the entire session — keep it there.

═══════════════════════════════════════════════════════════════════
## 10. FIRST ACTIONS FOR NEXT WINDOW
═══════════════════════════════════════════════════════════════════

1. Read memory + this handoff.
2. Verify baseline (§2 first actions): HEAD = 0c69264 or higher,
   backend boots, DATABASE_URL = localhost.
3. Report to founder in plain English: "Read memory + handoff. Main
   at <hash>. Wave 2 commit 1 (wallet breakdown) live. Remaining:
   Wave 2 commit 2 (brand withdrawal, M075), commit 3 (L2 GST, M076),
   commit 4 (mid-cycle pro-ration). All move real money. Which first —
   or start commit 2 (brand withdrawal)?"
4. HOLD for direction. Recommend starting commit 2 (brand withdrawal)
   since it's the highest-value blocker after the audit.

═══════════════════════════════════════════════════════════════════
END OF HANDOFF.
═══════════════════════════════════════════════════════════════════
