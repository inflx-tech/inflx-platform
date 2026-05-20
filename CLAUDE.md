# INFLX — AI-Governed Software-Engineering Operating System

> This repo is run as an **operating system for software engineering**,
> not an app with tests bolted on. **`GOVERNANCE.md` (repo root) is the
> canonical charter** — read it. This file is the lean always-loaded
> entry point: the operating rules first, then the project reference
> needed to not introduce bugs. On any conflict, `GOVERNANCE.md` wins;
> auto-memory mirrors these rules for cross-session recall.

---

## 1. Operating rules (MANDATORY — full detail in GOVERNANCE.md)

**Every unit of work is a contract** in `features/<slug>/`
(`01-spec.md 02-workflow.md 03-expected-outputs.md 04-preview/
05-impact.md lock.json`). `features/_TEMPLATE/` is the scaffold.

Lifecycle: **spec → workflow → Step-5 LOCK → HTML mockup +
workflow-prediction in `04-preview/` → mockup-lock (advisory) →
impact → implement → before/after diff (Phase 2 sub-contract 2,
coming) → Playwright/API/DB + Maestro mobile verify → fix → retest →
Step-14 RELEASE → record into repo artifacts.**

> **Mockup-lock gate (Phase 2 sub-contract 1, contract
> `features/preview-machinery/`, advisory):** for UI-touching
> features, after spec-lock author HTML mockups in
> `features/<slug>/04-preview/mockups/*.html` + a
> `04-preview/workflow-prediction.md`. Run
> `pnpm preview:open <slug>` to review them in the browser, then
> set `mockup_locked: true` (+ `_by` + `_at`) in `lock.json`.
> See `features/_demo-preview/` for a worked example.

- No governed-path code (`backend/src/**`, `backend/migrations/**`,
  `Packages/*/{src,app,components,lib,...}`) without an **approved
  contract**. Enforced by `qa/scripts/governance-check.mjs` (local
  pre-push hook + CI `.github/workflows/qa.yml`). `pnpm run
  hooks:install` activates the local layer.
- **No implementation before the Step-5 lock.** The founder may
  delegate the lock *decision*; contract *existence* is enforced.
- Success = the **workflow executes to its expected end state**,
  proven by `pnpm qa`. "It compiled" is never success.
- **No-fake-green (absolute):** never `.skip`, delete a test, weaken
  an assertion, fabricate data, or force-pass. Uncertainty → fail.
  C1 verdict state machine + 10 fidelity meta-tests enforce this;
  extends to CI.
- **Verify-twice:** before any root-cause / "X exists" claim, read the
  actual controller/route/migration/schema. A real stack trace beats
  any hypothesis.
- **Failure taxonomy:** classify every failure — stale fixture /
  business-rule drift / genuine backend defect (carve
  `features/backend-defect-<slug>/`, leave RED until backend-fixed) /
  assertion drift. Tests are never auto-trusted.
- **Regression:** every backend/runtime change reruns `pnpm qa`,
  confirms C1/gate, proves zero regression. `pnpm qa:db` is a
  **separate, decoupled, informational** lane — never merged into
  the main GREEN, never blocks it, until formally promoted.
- **Release classification on every release:**
  - **deploy-inert** (tests, qa, `features/**`, docs, CI, dev
    tooling, metadata) — `git push` changes nothing in production.
  - **production-impacting** (`backend/src/**`, migrations, web/mobile
    runtime, runtime deps) — `git push` changes Render/Vercel/OTA.
    **Surfaced explicitly, never silent; explicit go required.**
- Memory: durable operator/process facts persist in auto-memory
  (`MEMORY.md` index). Repo artifacts (contracts, ledgers, lock.json,
  QA reports) are the durable engineering record.

**Standing autonomy:** the founder has delegated routine decisions
("take your best decision, don't ask"). Exercise judgement; do not
gate on questions for deploy-inert work or design/lock choices.
**Carve-out (founder's own rule):** production-impacting deploys are
still surfaced for explicit go and never silent.

## 2. OS phase roadmap (detail in GOVERNANCE.md §14)

P0 pipeline foundation ✅ · **P1 governance-enforcement substrate
(active, deploy-inert)** · P2 backend-test-debt Phase 4 · P3 QA
reporting usability · P4 environment governance *(prod-impacting,
gated)* · P5 observability *(prod-impacting, gated)* · P6 Maestro
mobile E2E *(gated)* · P7 multi-agent governance. Each phase = one
or more contracts through the full pipeline.

---

## 3. Project reference (condensed — enough to not ship bugs)

**What INFLX is:** a three-sided influencer-marketing platform for
India. **Brands** create/fund campaigns, assign influencers, review
content. **Influencers** receive offers, negotiate, sign, submit
content, track earnings. **Followers** discover deals via share
links, pay-at-store/book/buy/enquire. **Admin** approves accounts,
RBAC, payment config, stats. Master spec: `Docs/INFLX_Master_Spec.docx`
(v1.0, LOCKED) — don't deviate without founder confirmation.

**Tech stack (locked):** RN mobile (brand+influencer+follower, one
codebase) · React/Next.js web (brand+admin, SSR) · Node/Express REST
backend · PostgreSQL via Supabase · Cloudflare R2 files · MSG91 OTP ·
Razorpay payments · Apify scraping · Firebase FCM · Elasticsearch ·
Redis · Cloudflare CDN (category schemas).

**Deployment reality (verify-twice — supersedes older "Railway/Expo"
spec text):** `git push origin main` →
**Render auto-deploys backend**, **Vercel auto-deploys brand-web +
admin-web**. Mobile JS ships via **OTA bundles** (`scripts/publish-ota.js`
→ R2); native changes need an APK rebuild. **No staging — prod-as-
staging** (P4 will address). Directory casing: real dirs are
`Packages/*` (`Packages/brand-web`, `Packages/Mobile`); some scripts
still glob lowercase `packages/*` — known workspace bug, deferred;
brand-web is NOT pnpm-workspace-managed (started from its own
node_modules).

**Money — ALL RUPEES** (since migration 021): every DB value & API
field is rupees `numeric(x,2)`. Paise only at the Razorpay boundary
via `utils/money.js` `toPaise`/`fromPaise`. Never scatter `*100`/
`/100`. Frontend `fmtMoney`=`fmtRupees` (both rupees).

**Core tables:** `users`(phone E.164, role, status) ·
`brands`(wallet_balance, platform_fee_pct=8%) — **no `city` col;
brand city lives on `users`** · `influencers`(handle, niche[],
wallet_balance, pending_balance) · `followers` · `campaigns`
(draft→pending_wallet→published→active→live→completed/cancelled) ·
`campaign_sets`(handpick/open_group) · `campaign_influencers`
(invited→accepted/negotiating→contracted→active→completed/declined/
expired) · `deliverables` · `negotiations`/`negotiation_turns` ·
`campaign_offers`(flat/percentage/bogo/bundle/volume/prebook) ·
`wallet_transactions` · `escrow_entries`(tranche 1/2/3) ·
`follower_transactions` — **the attribution table; all 4 IDs
(campaign/set/offer/influencer) on every row** ·
`influencer_withdrawals`(TDS 10% at withdrawal) · follower
addresses/orders/bookings · `enquiry_leads` · `notifications`.

**API:** base `https://api.inflx.in/v1`; phone+OTP→JWT RS256
(access 15m, refresh 30d HttpOnly). Standard envelope:
`{success:true,data,meta}` / `{success:false,error:{code,message,
field}}`. Codes: UNAUTHORIZED, FORBIDDEN, NOT_FOUND,
VALIDATION_ERROR, WALLET_INSUFFICIENT, OFFER_EXPIRED, WRONG_TURN,
ALREADY_SIGNED, REVISION_LIMIT_EXCEEDED, STOCK_UNAVAILABLE,
SLOT_FULL, RATE_LIMITED, INTERNAL_ERROR. Tracking URL:
`inflx.in/s/{handle}?cid&sid&oid&iid` (4 IDs inherited → auto
commission attribution).

**RBAC:** brand · influencer · follower · admin:superadmin (all) ·
admin:reviewer (queue, read-only) · admin:finance (escrow/payouts).
JWT carries role + sub + role IDs. Admin endpoints default to
`requireAnyAdminRole` (the founder's daily account isn't always
superadmin).

**Key business rules:** platform fee 8% (admin-configurable per
brand, charged to brand on top) · tranche 25/25/50 (T1 both-sign,
T2 brand-confirm-live, T3 +30d auto) · offer expiry 48h · commission
return window 30d (pending_balance→wallet_balance, 00:01 IST cron) ·
TDS 10% statutory at withdrawal · min withdrawal ₹100 · max 2
revision rounds · wallet must hold full budget to publish.

**Dev mocks (prod = swap .env):** OTP `000000` · Razorpay test card
`4111111111111111` · Apify fixture · FCM console.log · R2 local tmp.
`ENABLE_CRONS=false` in test env.

**Build state:** Phases 1–6 (infra→follower app→crons/payouts→full
UI) complete; current engineering focus is the governance OS
(this file's §1–§2) and reliability stabilization. Detailed build
history → `git log` and `features/*/` contracts (authoritative).
