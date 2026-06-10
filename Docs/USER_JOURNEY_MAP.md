# INFLX — End-to-End User Journey Map + Test Plan

> Authored 2026-06-10 from full code analysis. This is the master reference for
> journey-based testing and fixing. Each stage lists: what the code does today,
> file evidence, status (WORKS / BROKEN / STUBBED), and how it's tested.
> Companion to `design/wave4-creator-vibe/AGREED-VS-BUILT-DIFF.md` (follower
> screens) and the 2026-06-10 follower diagnostic (5 bugs).

---

## The platform as one connected journey

```
STAGE 1          STAGE 2           STAGE 3            STAGE 4              STAGE 5            STAGE 6             STAGE 7
Onboarding  →   Brand setup   →   Campaign      →    Influencer      →    Content go-live →  Follower journey →  Money settles
(all roles,     (listing +        (sets, budget,     collaboration        (review, live,     (discover, store,   (commissions,
 admin           offer library)    publish,           (accept/negotiate/   T2, share link)    transact 4 modes)   tranches, T3,
 approvals)                        assignment)        sign, T1)                                                   withdrawal)
```

Interconnections that matter: approval gates everything (Stage 1 → all);
wallet funding gates contract signing (not publish); the share link's 4 IDs
(cid/sid/oid/iid) are minted in Stage 5 and must survive untouched through
Stage 6 into `follower_transactions` for Stage 7 to pay the right people.

---

## STAGE 1 — Onboarding + Admin approval — STATUS: ✅ WORKS (2 small gaps)

Phone+OTP (dev mock `000000`) → role-scoped registration → admin queue → approve/reject/resubmit.

- Brand: web /login → `POST /v1/auth/verify-otp` → register form → `POST /v1/brands/register` → users.status='pending' → /waiting → admin approves (`PATCH /v1/admin/brands/:id/status`) → /dashboard. Rejection → /rejected → resubmit loop works (`brand.controller.js:314`).
- Influencer: mobile OTP → InfluencerRegister → Apify scrape (mock) + creator_profiles claim (1-match/conflict/0-match all handled, `influencer.controller.js:91-192`) → pending → admin approve.
- Follower: **auto-approved at OTP** (`auth.controller.js:121-127`), no admin gate.
- Gates verified: `requireApproved` blocks campaign create/publish + influencer search (`middleware/auth.js:143-151`); pending brands CAN build products (founder decision 2026-06-07) which stay invisible to followers until approved; pending influencers invisible to handpick search (SQL `u.status='approved'`).
- Subscription/entitlement gates: multi_branch, bulk_outreach via `entitlementsService.requireFeature`.

Gaps: (a) pending influencers may be able to view offer inbox — no status guard on `GET /influencers/me/offers` (`influencer.routes.js:27`) — verify intent; (b) creator-verification queue is parallel to influencer approval — confirm it's not an accidental second blocker.

## STAGE 2 — Brand setup: listing + offer library — STATUS: ⚠️ PARTIAL

- Listing engine (fashion/generic): drill-down tree (`GET /listing/tree`), facets, **batch product create** `POST /brands/me/products/batch` with validation, auto-SKU (store_code + seq), variants, listing_brands flywheel — `listing.controller.js:119-192`. ✅ WORKS.
- Restaurant dish-dictionary listing: partially built (contract #1 on branch `feat/listing-restaurant-search-flywheel`, not yet deployed). ⚠️
- Furniture: taxonomy seeded, but facet drill not verified in UI; no furniture brands registered. ⚠️
- Offer library CRUD (`brand_offers`): create/list/update/archive + attachments view — `brandOffer.controller.js`. ✅ WORKS.
- **Store-direct offer publishing: STUBBED** — `published_to_store` columns exist (migration 085) but no publish endpoint/UI. ❌

## STAGE 3 — Campaign creation → publish → assignment — STATUS: ✅ WORKS (apply-flow unverified)

- Campaign draft (`POST /campaigns`, `campaign.controller.js:325`) → sets (engagement needs set_budget; conversion needs coupon_prefix; `createSet:564`) → publish (`publish:1109`): wallet pre-flight (full budget), protection fee locked, open-group invites materialised (filters, tier caps, 48h expiry, `materialiseOpenGroupInvites:160`).
- Handpick invite (`invite:814`): offer attachment from library (snapshot) or inline; coupon uniqueness; cross-set prevention; budget caps.
- State machines verified in code: campaigns (draft→active→live→completed/cancelled), campaign_influencers (8 states), contracts (4 states), deliverables (6 states), escrow (6 states).
- Key nuance: **wallet money locks per-contract at brand-sign, NOT at publish** (publish only pre-checks balance).
- Unverified: open-group **application** flow (influencer applies → brand approve/reject endpoints exist, mobile wiring unconfirmed). ⚠️

## STAGE 4 — Influencer collaboration — STATUS: ✅ WORKS

- Offer inbox + 48h expiry (cron every 15 min, `offer-expiry.job.js:33-50`), countdown UI.
- Negotiation: turn-taking with WRONG_TURN (`offer.controller.js:484-489`), counter resets 48h SLA, accept/walkaway, auto-expiry cron (30 min). ✅
- Contract: auto-created on accept (`contract.service.js:autoCreate`, idempotent), influencer sign → brand countersign = **wallet lock + escrow T1/T2/T3 created + T1 (25%) released immediately** (`contract.controller.js:412-550`), deliverables auto-created from formats_json, PDF async. Bulk-sign atomic (max 100). ✅
- Conversion-only contracts: no escrow, commission-only — by design.

## STAGE 5 — Content → live → tracking link — STATUS: ✅ WORKS (1 big stub)

- Submit (URL or R2 media) → brand review → approve / request-revision (max 2, REVISION_LIMIT_EXCEEDED enforced `deliverable.controller.js:228-233`) → submit-live URL → brand confirm-live → **T2 (25%) releases only when ALL deliverables live** (race-guarded, `confirmLive:316-410`) → CI status 'active'.
- T3 (50%): auto-release cron 30d post-live at 03:00 IST (`tranche-3-release.job.js`). ✅
- **STUB: share-link surface** — `buildTracking()` exists (`utils/tracking.js:26-41`), `/s/:handle` redirect + click log works (`tracking.controller.js:18-60`), but the influencer app has NO screen to copy/share their link. The funnel's front door has no handle. ❌

## STAGE 6 — Follower journey — STATUS: 🔴 MOST BROKEN STAGE

Entry: share link → web redirect → app; **no deep-link routing handler found in FollowerNavigator** — attribution may be lost on app entry. ❌ NEEDS VERIFICATION.
Discovery: Home/Offers/Category/Creator Store via section engine; config only has dining+shopping (migration 083). ⚠️
Business page/product: bespoke per vertical; fashion falls to legacy BrandStoreScreen with hardcoded "Pay at salon" (line 566). 🔴
Transact modes:
- (a) Pay-at-store: works end-to-end incl. attribution + commission. ✅
- (b) Online order: works BUT 3-step (create → pay → verify) loses the order silently if verify never fires; mock order expiry >30min → unrecoverable "Payment Error". 🔴
- (c) Prebook (slot + date-range): token payment works; balance-pay-at-venue chain untested. ⚠️
- (d) Enquiry: form → enquiry_leads works; brand-side lead handling unverified. ⚠️
Offer tap → ProductDetail 404 ("Offer not found"): brand_offer_id vs campaign_offers lookup mismatch (`follower.controller.js:470-489`). 🔴 (diagnostic 2026-06-10)
Post-purchase: activity inbox under-built vs mockups; returns flow exists; saved/wallet exist.
New items from this analysis: `followerApi.getAddresses` possibly undefined (runtime error risk in OnlineOrderScreen); verifyOrder consumeMockOrder throws on expired order with no recovery; OnlineOrderScreen success-detection edge (`res.success` true but data null).

## STAGE 7 — Money settles — STATUS: ✅ CORE WORKS / ⚠️ EDGES DORMANT

- Commission → pending_balance at txn time → 30d window → cron moves to wallet_balance. ✅
- Marketplace fee (L3) computed per-category per-path on every txn. ✅
- TDS 10% + min ₹100 withdrawal via RazorpayX (+retry). ✅
- Path classification (direct/live-link/window) implemented; **store-beats-window dormant** (app never sends via_store_influencer_id). ⚠️
- Razorpay Route brand settlement: built, fires only when brand has linked account — none onboarded. ⚠️
- TCS + per-category return-window columns: read by settlement, **no admin UI**. ⚠️
- L1 subscription billing: not built. ❌

---

## Consolidated break list (ranked by funnel impact)

| # | Break | Stage | Severity |
|---|-------|-------|----------|
| 1 | Offer tap → "Offer not found" (new offer IDs vs old lookup) | 6 | 🔴 kills purchase funnel |
| 2 | Share-link deep-link handler missing/unverified in app — attribution at risk | 6 | 🔴 kills influencer attribution |
| 3 | Influencer has no screen to get their share link | 5 | 🔴 funnel has no entry |
| 4 | Online order silently lost if verify step never fires | 6 | 🔴 lost orders + trust |
| 5 | "Pay at salon" + hardcoded CTAs on non-restaurant business pages | 6 | 🟠 wrong UX, agreed design violated |
| 6 | Section config missing 5 of 7 verticals (furniture etc. invisible) | 6 | 🟠 catalog invisible |
| 7 | Store-direct offer publish stubbed (no endpoint/UI) | 2 | 🟠 offer engine channel dead |
| 8 | Open-group application flow unverified mobile↔backend | 3 | 🟡 |
| 9 | getAddresses API method possibly missing → crash risk in order flow | 6 | 🟡 |
| 10 | Prebook balance-pay chain, enquiry brand-side handling untested | 6 | 🟡 |
| 11 | Blank chips, duplicate empty-state, "0 places" count | 6 | 🟡 polish |
| 12 | Pending influencer may see offer inbox (gate gap) | 1 | 🟡 verify intent |

## Test plan

**Phase A — Claude runs the golden path locally (local backend + dev DB, all mocks):**
API-driven E2E: brand signup→approve (admin) → listing batch → offer library → campaign+set → publish → handpick invite → influencer accept → negotiate 1 round → sign both (assert T1 + wallet lock) → submit content → revise once → approve → live → confirm-live (assert T2) → follower: store fetch → pay-at-store (assert 4 IDs + commission pending) → online order → prebook → enquiry → simulate window expiry → assert commission release. Every assertion against DB state. Output: PASS/FAIL ledger per step.

**Phase B — Founder on-device script (prod app, real device):**
Scripted checklist for what API tests can't see: share-link tap from WhatsApp → app open → attribution survives; section-engine rendering; Razorpay real sheet; OTA-served screens. Each step = expected vs actual.

**Phase C — Fix sprints, one journey stage at a time** (contract per fix, deploy gates per GOVERNANCE.md):
Sprint 1 = Stage 6 funnel (breaks 1,2,4,9) · Sprint 2 = Stage 5/6 attribution loop (3, share UI + deep link verify) · Sprint 3 = Stage 6 design conformance (5,6,11 → wave4 mockups) · Sprint 4 = Stage 2/3 (7,8) · Sprint 5 = Stage 7 edges (settlement onboarding, admin UIs).

Re-run Phase A after every sprint (regression).
