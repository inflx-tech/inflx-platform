# Defects & Drift Found During Flow Mapping (2026-05-22)

These were surfaced by the verify-twice deep-read. **None are
fixed here** — each is gated work (most are production-impacting).
Listed worst-first.

## D1 — T3 escrow tranche never auto-releases ⚠️ MONEY STUCK (production-impacting)
- `escrow.service.js:74` creates ALL 3 tranches with `status='locked'`.
- `tranche-3-release.job.js:29` only matches `status='queued' AND triggered_at <= now-30d`.
- **No production code path ever flips T3 `locked → queued` or stamps `triggered_at`.** The `'queued'` status appears ONLY in test fixtures.
- **Consequence:** the final 50% tranche never auto-releases in prod. Only the admin manual-release path works. Real influencer money is stuck.
- Fix = a contract: either create T3 as `queued` with `triggered_at` at content-live, OR change the cron to find `locked` T3 entries past their window. Production-impacting (escrow/money) → gated, founder go required.

## D2 — Mobile withdrawal preview shows 100× (production-impacting via OTA)
- `Packages/Mobile/src/screens/influencer/EarningsScreen.js:177` — `fmtMoney(Math.round(parseFloat(amount)*100))` on the "Requested" line. `fmtMoney` now expects rupees, so it displays 100× the entered amount. (TDS + "You Receive" lines below correctly use rupees.) Stale paise-era code.
- Fix = one-line; ships via OTA → gated.

## D3 — brand-web wallet low-balance threshold stale paise (production-impacting via Vercel)
- `Packages/brand-web/app/dashboard/wallet/page.js:194-195` — `balance < 1000000` with a stale "paise" comment. Post-021 balance is rupees, so it warns until ₹1,000,000 instead of ₹100.
- Fix = one-line; Vercel deploy → gated.

## D4 — JWT is HS256, not RS256 (doc drift, deploy-inert to fix the doc)
- CLAUDE.md says "JWT RS256"; `jwt.service.js` uses jsonwebtoken defaults = HS256 with symmetric `JWT_SECRET`. Either fix the doc (deploy-inert) or migrate to RS256 (production-impacting, bigger).

## D5 — "Max 2 negotiation rounds" does not exist (spec/expectation drift)
- Negotiation counters are uncapped in code. The "2" is the deliverable `revision_limit` (post-contract content revisions). If the founder wants a negotiation-round cap, it's a new feature, not a bug fix.

## D6 — admin_role absent from client user object (cosmetic / UX)
- verify-otp's `safeUser` omits `admin_role`; admin-web shows all nav to every admin. RBAC is enforced server-side (API 403), so it's not a security hole, but reviewers see links they can't use. UX polish.

## D7 — Cron timezone inconsistency (correctness)
- commission-confirm runs `1 0 * * *` IST; tranche-3-release runs `0 6 * * *` UTC (no tz arg). Inconsistent; worth aligning when D1 is fixed.

## D8 — STOCK_UNAVAILABLE declared but never thrown (dead code / spec drift)
- Declared error code; no live throw site in the purchase path. Either wire it (variant out-of-stock) or remove from the spec.

## D9 — Conversion handpick invite silently dropped on publish ⚠️ (found via E2E 2026-05-22)
- **Repro (E2E):** brand-web new-campaign wizard → conversion set → handpick + assign an influencer → fill post_date + commission but NOT an offer type → Review → Publish. Campaign publishes `active` with **0 influencers**.
- **Cause:** backend `campaign.controller.js:654` requires `offer_type` for conversion/hybrid invites (→ 422), but the wizard's client validation (`validateSets`) only requires `post_date` + `commission_pct`, NOT `offer_type`. So `POST /sets/:sid/invite` 422s, and **publish does not block on invite failure** → the brand gets an active campaign they think has an influencer, but it's empty.
- **Confirmed in dev log:** `POST .../invite 422` ×2 then `POST .../publish 200`; DB shows the set with zero `campaign_influencers`. With an offer type selected, invite returns 201 and the influencer persists (commission 10%, offer Discount, coupon SAVE20_DUMMY).
- **Fix (2 parts, production-impacting → gated):** (a) wizard client validation should require `offer_type` for conversion/hybrid handpick influencers (mirror backend :654); (b) publish should surface/block on invite failures instead of swallowing them. Caught + regression-guarded by `qa/local-e2e/conversion-campaign.spec.ts` (asserts all invite responses are 2xx).

## Recommended sequencing
- **D1** is the highest-value real bug (stuck money) — strong candidate for the founder's "one real feature change" / first gated fix.
- **D2/D3** are quick money-display fixes (low risk, high visible value) — batch as a small production-impacting contract once the founder approves a push window.
- **D4/D6/D8** are deploy-inert doc/cleanup — can ride any contract.
- **D5** is a product decision, not a bug.
