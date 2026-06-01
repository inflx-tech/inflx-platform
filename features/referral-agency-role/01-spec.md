# referral-agency-role — Contract 3a: agency backend spine (role + wallet + settlement)

> **Contract 3 of 4** in the Referral / Strategic-Partner-Agency feature,
> **sub-contract 3a (backend-only)**. Builds on Contract 1 (engine) + Contract 2
> (admin controls). Makes agencies *real* so the engine's `payout_status='pending'`
> agency ledger rows settle into an actual agency wallet they can withdraw.
> The agency **mobile app** (new native APK flavor + screens + code-at-signup UI)
> is the separate **sub-contract 3b** (Mobile-governed, Maestro gate) — NOT here.

## Problem / goal
Contract 1 accrues agency referral commission but parks it as `pending` because
no agency entity/wallet existed. Contract 3a creates the agency as a first-class
role with a wallet, so:
- An agency can exist (role + profile), be **admin-approved** (same queue
  lifecycle as brands/influencers), and own a **referral code**.
- Referral accrual for an `agency` referrer **settles inline** into the agency
  wallet (mirrors the influencer-referrer branch — "if we earn, they earn"),
  flipping its ledger rows to `paid`.
- An agency can **withdraw** earnings with **TDS 194H @ 5%** (brokerage — vs the
  influencer's 194J/194C @ 10%).
- A referred brand/influencer can **redeem an agency's code** to create the
  referral edge (the backend endpoint; the signup UI is 3b).

Locked model (unchanged from C1/C2): referrer earns the admin-set % of platform
revenue from the referred entity for 12 months; carved from the platform slice
only; one active referrer per referred entity; accrues on confirmed revenue.

## Scope
- **In scope (backend only):**
  - **Migration `080_agency_role.sql` (+ runner `run-080.js`):**
    - `ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'agency'` — run standalone &
      **committed before use** (Postgres won't let a new enum value be used in
      the same txn that added it; per run-071/run-075 precedent).
    - `agencies` table: `id`, `user_id` (FK users, unique), `agency_name`,
      `contact_person`, `contact_email`, `city`, `state`, payout fields
      (`upi_id`, `bank_account_no`, `bank_ifsc`, `account_holder_name`),
      `wallet_balance`/`pending_balance`/`referral_earned_total`
      numeric(12,2) default 0, `tds_exempt bool default false`,
      `tds_override_pct numeric(5,2) null`, approval columns
      (`approved_at`, `approved_by`, `rejection_reason`), timestamps.
    - `agency_withdrawals` table: mirror `influencer_withdrawals`
      (`agency_id`, `amount_requested`, `tds_deducted`, `net_paid`, `method`,
      payout fields, `razorpay_payout_id`, `status`, timestamps).
    - `payment_config.agency_tds_pct numeric(5,2) default 5.00` (194H).
  - **Auth/role:** add `'agency'` to `VALID_ROLES` in `auth.controller.js`
    (agencies sign up via OTP → `users` row `status='pending'`, like brands).
  - **`POST /agencies/register`** (`agency.controller.js` + `agency.routes.js`):
    creates the `agencies` profile for the authenticated agency user; user
    stays `pending` for admin approval. **`GET /agencies/me`** returns the
    profile + wallet + their referral code (lazily created via
    `referral.service.getOrCreateCode('agency', agencyId)`).
  - **Admin approval:** `GET /admin/queue/agencies` +
    `PATCH /admin/agencies/:id/status` (mirror brand approval; finance/any-admin
    per existing convention; reuse `requireAnyAdminRole` default with the same
    semantics as brand/influencer approval).
  - **Engine settlement:** in `referral.service._accrueOnClient`, add an
    `agency` branch → credit `agencies.wallet_balance` +
    `referral_earned_total`, mark the ledger row `paid` (mirrors the influencer
    branch). Agency accruals are now live, not pending.
  - **Agency withdrawal:** `withdrawal.service` agency path computing TDS 194H
    @ `payment_config.agency_tds_pct` (default 5%, with agency `tds_exempt` /
    `tds_override_pct` honored), min-withdrawal + RazorpayX payout mirrored from
    the influencer path; `POST /agencies/me/withdraw` + `GET /agencies/me/withdrawals`.
  - **Code redeem:** `POST /referrals/redeem` (authenticated brand/influencer)
    `{ code }` → `referral.service.lookupCode` → `createEdge(referrer = code
    owner, referred = caller's brand/influencer, source='signup', pct =
    referral_settings.default_pct)`. Engine guards (self/circular/dedup) apply.
  - QA: jest for register/approval, settlement (agency wallet credited + ledger
    paid), withdrawal TDS 194H math, code-redeem + guards; `pnpm qa` GREEN.
- **Explicitly out of scope:**
  - **Agency mobile app** (new `in.inflx.app.agency` APK flavor, AgencyNavigator,
    agency screens) + **"enter referral code" signup UI** in the brand/influencer
    apps → **Contract 3b** (Mobile-governed; Maestro gate; native build).
  - **admin-web "Agencies" approval page** → small fast-follow (UI-governed);
    C3a exposes the approval **endpoints**; admin approves via API meanwhile.
  - Managed-partner recurring tier (C1's `kind` column already reserves it).
  - Influencer "Refer & Earn" → Contract 4.

## Surfaces touched
- **App(s):** backend only (Render). No web, no mobile, no OTA.
- **Roles involved:** new `agency` role (signup + register + withdraw, all
  authenticated as the agency user); admin (approval); brand/influencer
  (code redeem). All API-level; UI is 3b / fast-follow.

## Data / contracts
- New tables `agencies`, `agency_withdrawals`; new enum value `agency`; new
  `payment_config.agency_tds_pct`. All additive.
- `agencies.wallet_balance` is the agency's withdrawable referral earnings;
  `referral_earned_total` is the cumulative reporting counter (mirrors
  influencers).
- Money rupees `numeric(x,2)`; paise only at the Razorpay boundary
  (`utils/money.js`), reusing the influencer withdrawal payout path.
- Settlement is carved from the platform slice only (no change to influencer
  net / brand net / escrow) — identical to C1's invariant; agency rows simply
  move from `pending` to `paid` + credit the agency wallet.

## Non-functional
- **Auth/role gates:** `/agencies/register` + `/agencies/me*` require an
  authenticated `agency` user (+ approved for withdrawal). Admin approval =
  admin gate. `/referrals/redeem` requires an authenticated brand/influencer.
- **Failure modes handled:**
  - Enum value already present → `ADD VALUE IF NOT EXISTS` no-ops (idempotent).
  - Redeem a code for an entity that already has an active referrer → engine
    dedup → `409`/`422`, no edge created.
  - Redeem own code / circular → `422 VALIDATION_ERROR`.
  - Withdraw more than `wallet_balance` / below min → `422`.
  - Agency not approved → withdrawal blocked (`403`/`422`).
  - Settlement failure inside accrual → same best-effort isolation as C1 (logged,
    host money path unaffected; ledger row left `pending` for a safe retry).
