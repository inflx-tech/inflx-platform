# INFLX — Master Flow Catalog (code-verified 2026-05-22)

Every flow below is grounded in the ACTUAL code (verify-twice).
Where the master spec / CLAUDE.md disagreed with the code, the
code wins and the drift is flagged ⚠️. API base = `/v1`.

Legend: **[B]**=brand · **[I]**=influencer · **[F]**=follower ·
**[A]**=admin · **[⚙]**=system/cron.

---

## DOMAIN 1 — AUTH & ONBOARDING

### 1.1 Phone + OTP login [B/I/F/A]
- `POST /auth/send-otp {phone}` (public) → OTP (`000000` in mock; TTL 10min, single-use, prior unused invalidated).
- `POST /auth/verify-otp {phone, otp, role?, name?}` (public) → looks up `users` by phone; existing → load; new → insert `users status='pending'` (role required). New **follower** auto-creates `followers` row + flips `status='approved'` immediately. Issues access JWT (15min) + refresh (30d HttpOnly cookie web / body for mobile).
- Phone gate: `^\+91[6-9]\d{9}$` (India only).
- ⚠️ JWT is **HS256** (symmetric `JWT_SECRET`), NOT RS256 as CLAUDE.md claims.
- Mobile role-guard: brand/influencer APK refuses login if `user.role !== APP_ROLE`. Admin → "use the web dashboard."

### 1.2 JWT refresh + rotation [all]
- `POST /auth/refresh` (public) → validates DB hash, **rotates** (new access+refresh, old revoked). Session renews indefinitely if app opened within any 30d window.
- `POST /auth/logout` → revokes refresh token, clears cookie.

### 1.3 Brand registration [B]
- `POST /brands/register` (brand role) → validates business_name/category/name/city/state/address/pincode; 409 on duplicate. City+state live on `users` (NOT `brands`). Status stays `pending` until admin approves.
- Web-only (brand-web `/login` step=register). Mobile brand APK has NO register screen → depends on profile existing.

### 1.4 Influencer registration [I]
- `POST /influencers/register {name, instagram_handle, city?, youtube_handle?}` (influencer role) → Apify scrape (mock) seeds followers/ER/niche; **creator-profile claim** logic: 1 match→claimed; >1→admin-conflict; 0→stub profile. Status stays `pending`.
- Mobile-only (`InfluencerRegisterScreen`).

### 1.5 Follower registration [F]
- **Auto-approved at verify-otp** — no admin review. `POST /followers/register` is just idempotent profile completion (name/city/state).

### 1.6 Admin login + RBAC [A]
- Admins pre-provisioned (`POST /admin/users`, superadmin only). Login = phone+OTP, no role param. Web-only.
- 3 sub-roles in `admin_profiles.admin_role`: **superadmin** (all), **reviewer** (approval queue), **finance** (escrow/payouts).
- `requireAdminRole(x)`: superadmin always passes; reviewer/finance pass ONLY their exact domain (not interchangeable).
- `requireAnyAdminRole`: any admin (reads default here).
- ⚠️ admin-web sidebar shows ALL nav to every admin; `admin_role` isn't even in the client user object — enforcement is 100% server-side (reviewer clicking Payouts gets API 403).

### 1.7 Approval gating [B/I]
- `requireApproved` middleware: approved→pass; pending→`ACCOUNT_PENDING`; rejected→`ACCOUNT_REJECTED`. Applied to brand action routes + influencer search/analytics. NOT applied to followers.
- Admin approve/reject: `PATCH /admin/brands/:id/status` & `/influencers/:id/status` (reviewer+). reject requires `reason`. States: `pending→approved|rejected|suspended`; `rejected→pending` via resubmit (`POST /brands/resubmit`; brand only — no influencer resubmit endpoint).

---

## DOMAIN 2 — CAMPAIGN CREATION  ⚠️ **WEB-ONLY** (mobile shows "create on web")

### 2.1 Campaign lifecycle (CORRECTED)
⚠️ Real code: `draft ──publish──▶ active ──(deliverables live)──▶ live ──(cron)──▶ completed` (+ `cancelled`). The spec's `pending_wallet`/`published` are legacy filter buckets only — publish sets status straight to **`active`**.

### 2.2 The THREE goal types (`campaign_sets.goal`, per-SET)
`VALID_GOALS = ['conversion','engagement','hybrid']` (campaign.controller.js:445). A campaign can mix goals across sets.

| Goal | Meaning | set_budget | coupon_prefix | offer_type | Wallet check |
|---|---|---|---|---|---|
| **engagement** | Fixed pay for content; no sales tracking | **required** | forbidden | forbidden | wallet ≥ budget + L2 fee |
| **conversion** | Commission-only; coupons track sales | forbidden | **required** | **required** | none |
| **hybrid** | Fixed fee + commission | **required** | **required** | **required** | wallet ≥ budget + L2 fee |

### 2.3 Handpick vs Open-group (`campaign_sets.influencer_mode`, orthogonal to goal)
- **Handpick** — brand searches + picks specific influencers (`GET /campaigns/:id/influencer-search`), invites each via `POST /campaigns/:id/sets/:sid/invite` → `campaign_influencers status='invited'` with per-influencer fee/budget/offer/coupon. Negotiation allowed.
- **Open-group** — brand sets `open_group_filters` (tiers/niches/cities/min_er/gender) + `max_cap` + `per_influencer_budget`. At publish, `materialiseOpenGroupInvites` resolves filters → inserts one `invited` row per match (48h expiry, cap 1000). Influencer accept → `applied` (NOT accepted, NO contract). Brand reviews: `approve-application` (→accepted+contract) / `reject-application` (→rejected_by_brand). Slot cap enforced with `FOR UPDATE` lock → `SLOT_FULL`; remaining flip to `slots_filled`. **Negotiation FORBIDDEN.**

### 2.4 Offer types (conversion/hybrid only)
Engine: `offer.service.js resolveOfferDiscount`. Types: **discount** (flat/percentage), **volume** (tiered), **bogo**, **bundle**, **free_gift**, **prebook** (legacy only; token-only/zero discount). Engagement sets reject offer_type.

### 2.5 Publish [B] `POST /campaigns/:id/publish`
Must be draft + have ≥1 set. If engagement/hybrid present: require total_budget>0, set-budget sum ≤ total, **wallet ≥ total else `WALLET_INSUFFICIENT`**. No money moves at publish (locked per-contract at brand-sign); L2 escrow-fee locked here. Status → active; notifies invited influencers.

### 2.6 Key edge cases
WALLET_INSUFFICIENT; must have/keep ≥1 set; budget invariants (set sum ≤ campaign, per-influencer sum ≤ set); goal field invariants; draft-only mutations; cross-set duplicate influencer→409; open-group cap race→SLOT_FULL; cancel refunds locked escrow+fee.

---

## DOMAIN 3 — ACCEPTANCE / NEGOTIATION / CONTRACT
⚠️ All accept/reject/negotiate logic lives in `offer.controller.js` (negotiation.routes.js imports it — no separate controller).

### 3.1 Offer inbox [I]
`GET /offers/inbox` (influencer); detail `GET /offers/:id`. Open-group offers appear as ordinary `invited` rows.

### 3.2 Offer expiry [⚙] — 48h
Cron every 15min: `invited` + `offer_expires_at < now()` → `expired`, notify brand. (`negotiating` rows handled by separate negotiation-expiry job.)

### 3.3 ACCEPT branch [I] `POST /offers/:id/accept`
Status must be `invited`. **Handpick** → `accepted` + `contractService.autoCreate` (draft contract). **Open-group** → `applied`, NO contract (it's an application).

### 3.4 REJECT/DECLINE branch [I] `POST /offers/:id/decline`
`reason` required ∈ {not_relevant, fee_too_low, schedule_conflict, already_partnered, other}. Status invited|negotiating → `declined`. (Open-group brand-side reject = `reject-application` → `rejected_by_brand`.)

### 3.5 NEGOTIATE branch [I→B↔I]
- Initiate `POST /offers/:id/negotiate` (influencer): guards — no duplicate, status=invited, allow_negotiation≠false, NOT open_group, must provide proposed_fee or proposed_commission_pct (commission gated behind admin flag). Creates `negotiations status='awaiting_brand', current_turn='brand', expires_at=now+48h` + first `negotiation_turns` row; CI → `negotiating`.
- Respond `POST /negotiations/:id/respond` (brand|influencer): **WRONG_TURN** enforced (only current_turn party may act). Actions: **counter** (flip turn, reset 48h SLA), **accept** (negotiations=agreed; CI=accepted with last-turn fee/commission; autoCreate contract), **walkaway** (negotiations=walked_away; CI=declined).
- ⚠️ **"Max 2 negotiation rounds" does NOT exist** — counters are uncapped. The "2" is the deliverable `revision_limit` (post-contract content revisions), a different mechanism.
- SLA: `negotiation-expiry` cron every 30min → stalled → walked_away + CI declined, both notified.

### 3.6 Brand approve (the gate the spec omitted) [B] `POST /contracts/:id/approve`
⚠️ Contract is born `draft`, not `pending_influencer`. Brand must approve (set custom_clauses/bonus/content_requirements/production_mode) → `pending_influencer`. Wallet pre-check `(base+bonus)×1.08 ≤ wallet`.

### 3.7 Influencer signs [I] `POST /contracts/:id/sign`
Must be `pending_influencer`; typed_name required → `pending_brand`.

### 3.8 Brand counter-signs [B] `POST /contracts/:id/brand-sign` (or bulk-sign)
Must be `pending_brand`. **Wallet lock = effectiveFee×(1+platform_fee%)** else WALLET_INSUFFICIENT. Atomic: debit wallet (escrow_lock), contract→active, CI→contracted, create production_event, create 3 escrow tranches + **release T1**, auto-create deliverables from formats_json. Conversion-only (fee=0) skips lock+escrow.

### 3.9 Deliverable cycle [I↔B] → T2
`pending → submitted (I) → approved|revision_requested (B)` → `submit-live (I) → confirm-live (B)`. **revision_limit=2** → REVISION_LIMIT_EXCEEDED. confirm-live sets deliverable `live`, CI `active`; when ALL deliverables live → release **T2**.

### 3.10 Inbound proposals [I] (reverse of invite)
`proposal.routes.js`: influencer discovers brands → pitches; brand accept inserts CI directly at `accepted` + autoCreate contract → rejoins 3.6→3.8.

### 3.11 CI status machine
`invited → accepted (handpick) | applied (open) | negotiating | declined | expired`; `applied → accepted | rejected_by_brand | slots_filled`; `negotiating → accepted | declined`; `accepted → contracted → active → completed`.

---

## DOMAIN 4 — FINANCE  (all RUPEES since mig 021; paise only at Razorpay boundary)

### 4.1 Brand wallet top-up [B]
`POST /brands/me/wallet/topup` → Razorpay (mock auto-succeeds) → `/verify` (HMAC verify live) → atomic credit `wallet_balance += amount` + `wallet_transactions(type=topup)`. `escrow_locked` derived from escrow_lock debits.

### 4.2 Escrow lock + tranche creation [I-sign then B-sign]
At **brand-sign** (NOT publish): lock = fee×(1+8%). Creates 3 `escrow_entries` all `status='locked'`: T1 25% (`contract_signed`), T2 25% (`content_live`), T3 50% (`day_30_post_live`). Per tranche: `net_to_influencer = amount − amount×feePct`. Immediately releases T1 → influencer `wallet_balance += net`. Conversion-only: no lock/escrow.

### 4.3 T2 release [B] `POST /deliverables/:id/confirm-live`
When ALL deliverables for CI are `live` → release T2 (25%) → influencer wallet.

### 4.4 T3 auto-release [⚙] — ⚠️ **GENUINE GAP**
Cron `0 6 * * *` (06:00 **UTC**, not IST) looks for `status='queued' AND triggered_at <= now-30d`. **But entries are created `status='locked'` and NO production code ever flips T3 locked→queued or stamps triggered_at.** → **T3 never auto-releases in production.** Only admin manual release works today. The `'queued'` status exists only in test fixtures. **This is real money stuck — worth a fix contract.**

### 4.5 Follower purchase → commission [F buys, ⚙ confirms]
4 channels (pay-at-store / prebook / online-order / enquiry) write `follower_transactions` with all 4 attribution IDs. `validateTracking` requires CI∈{contracted,active,completed} + campaign∈{published,active,live} + not past end_date else `OFFER_UNAVAILABLE`. Commission = net×commission_pct → influencer **`pending_balance`** + `total_earned` (at sale). `return_window_ends_at = now+30d`.
- Confirm cron `1 0 * * *` (00:01 **IST**): window elapsed → move `pending_balance → wallet_balance` (the only withdrawable bucket).

### 4.6 Withdrawal + TDS [I]
`POST /influencers/me/withdraw {method∈upi|bank_transfer, amount}`. Guards: amount ≥ ₹100 (`WITHDRAWAL_TOO_SMALL`), ≤ wallet_balance, payment method on file. **TDS = amount×10%; net_paid = amount − tds.** Deducts wallet immediately (anti-double). Mock→completed; live→RazorpayX payout, rollback wallet on failure. Form 16A at `/influencers/me/tds-certificate`.

### 4.7 Razorpay webhooks [⚙]
`payout.processed`→withdrawal completed; `payout.reversed`→failed + refund wallet. Idempotent. Always 200.

### 4.8 Follower reward wallet [F]
Derived 3% (`REWARD_PCT`) of net on completed creator-attributed purchases. Separate from creator money.

### 4.9 Escrow fee tiers [A-superadmin]
`escrow_fee_tiers` CRUD; feeds `campaigns.escrow_fee_pct_locked` at publish.

### 4.10 Money reference
Platform fee 8% (on top, brand-charged) · tranche 25/25/50 · TDS 10% · min withdrawal ₹100 · follower reward 3%.

---

## DOMAIN 5 — FOLLOWER & ADMIN

### 5.1 Share-link attribution [F/⚙]
`inflx.in/s/{handle}?cid&sid&oid&iid` → `trackClick` logs `link_clicks`, 302-redirects to follower app store page preserving 4 IDs. `iid` = campaign_influencer_id (per-assignment), not raw influencer. All 4 IDs ride every transaction = auto-commission spine.

### 5.2 Discovery/browse [F] (all public via authenticateOptional; sign-in only at purchase)
home-feed (personalized if logged-in, city if anon), legacy feed, deals-by-category, stories, super-categories, category→stores (schema-driven dining filters), influencer store, brand store (?via=), search, creators-eating-now (48h social proof). Product detail CTAs from `offer.availing_modes`.

### 5.3 The 4 transaction types [F] (all initiate→verify, commission→pending_balance)
1. **Pay-at-store** — free-form bill, no cart; only Discount-type offers apply. Optional "pay balance" against a prior prebook.
2. **Booking/prebook** — advance/token only (₹200 default), platform_fee=0; writes `follower_transactions` + `follower_bookings` (BK######). Types: table/slot/appointment/date_range (car/hotel). `SLOT_FULL` if capacity hit.
3. **Online order** — real cart + delivery address; full offer engine; writes `follower_orders` (confirmed→dispatched→delivered, brand-driven).
4. **Enquiry** — no payment; `enquiry_leads` (submitted→responded→converted); commission fires only when brand marks converted with deal_value.

### 5.4 Booking brand-status [B] (mig 052)
Restaurant table bookings start `brand_status='pending'` (await confirm); others NULL=auto-confirmed. Brand confirm/reject in BookingsInbox; reject→cancelled.

### 5.5 Returns [F→A] (Fashion-1)
`POST /follower/returns` (window per `return_policy_days`) → admin approve/reject/mark-refunded. States: requested→approved→received→refunded | rejected.

### 5.6 Admin operational flows [A]
- Approval queues (reviewer+): brands/influencers pending → approve/reject/suspend.
- Stats/analytics (any admin).
- **Escrow** (finance+): overview + manual release (`override_reason`).
- **Payouts/withdrawals** (finance+): queue + process (approve→payout / reject→refund).
- Per-brand platform-fee + escrow-fee override (finance+).
- Payment config (read any / write superadmin); escrow-fee-tiers (read any / write superadmin).
- Admin user mgmt (superadmin only).
- Creator verification queue + invitations (reviewer+).
- Master dishes (reviewer+).
- Marketing engine (lead intake/triage/funnel/inbox).
- Production coordination (visit/shipment/remote; admin can cancel).
- Production queue monitor (flags stale/overdue).

### 5.7 Key edge cases
SLOT_FULL, OFFER_UNAVAILABLE, ACCOUNT_PENDING/REJECTED, double-consume order→404, getStoreProducts needs offer_id/ci_id (anti catalog-leak), escrow already released→409, withdrawal not 'initiated'→409. ⚠️ `STOCK_UNAVAILABLE` is a declared code but has NO live throw site in the purchase path.

---

## CROSS-CUTTING DEFECTS & DRIFT FOUND (see DEFECTS-FOUND.md)
1. ⚠️ **T3 escrow never auto-releases** (locked vs queued mismatch) — money stuck.
2. ⚠️ **Mobile EarningsScreen.js:177** withdrawal preview shows 100× (stale paise).
3. ⚠️ **brand-web wallet** low-balance threshold stale paise (warns until ₹1,000,000).
4. ⚠️ **JWT HS256** not RS256 (CLAUDE.md drift).
5. ⚠️ **No max-2 negotiation cap** (spec implies one; only deliverable revisions cap at 2).
6. ⚠️ Campaign lifecycle uses `active` directly (not `pending_wallet`/`published`).
7. ⚠️ T3 cron runs **UTC** while commission cron runs **IST**.
8. ⚠️ `STOCK_UNAVAILABLE` declared but never thrown.
