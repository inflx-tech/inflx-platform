# INFLX - Master Project Context for Claude Code

## What INFLX Is
INFLX (inflx.in) is a **three-sided influencer marketing platform** for India, built for local/regional businesses and micro/nano influencers.

- **Brands** create campaigns, assign influencers, fund wallets, review content, view analytics
- **Influencers** receive offers, negotiate, sign contracts, submit content, track earnings
- **Followers** discover deals via share links, pay at store, book, buy online, enquire
- **Admin** approves accounts, manages RBAC, sets payment config, views platform stats

## Spec Location
`Docs/INFLX_Master_Spec.docx` — v1.0, LOCKED. All schema, API, payment logic, RBAC, and notifications are defined there. Do not deviate without user confirmation.

---

## Tech Stack (Locked — Do Not Change)

| Layer | Technology |
|---|---|
| Mobile (Brand + Influencer + Follower) | React Native (iOS + Android, single codebase) |
| Web (Brand + Admin) | React.js / Next.js (SSR) |
| Backend API | Node.js + Express (REST) |
| Primary Database | PostgreSQL via Supabase |
| File Storage | Cloudflare R2 |
| OTP / SMS | MSG91 |
| Payments | Razorpay (top-up, checkout, payouts) |
| Social Scraping | Apify (Instagram metrics) |
| Push Notifications | Firebase FCM |
| Search | Elasticsearch |
| Cache | Redis |
| CDN / Category Schemas | Cloudflare CDN |

## Deployment Targets
- API: Railway
- Web: Vercel
- Mobile: Expo EAS

---

## Database: Core Tables (Section 2 of Spec)

### Users & Roles
- `users` — id, phone (E.164), role (brand/influencer/follower/admin), status (pending/approved/rejected/suspended), fcm_token
- `brands` — wallet_balance, platform_fee_pct (default 8%), razorpay_contact_id
- `influencers` — instagram_handle, followers_count, engagement_rate, niche[], language[], wallet_balance, pending_balance
- `followers` — default_address_id
- `follower_follows` — composite PK (follower_id, influencer_id)

### Campaigns
- `campaigns` — status machine: draft → pending_wallet → published → active → live → completed/cancelled
- `campaign_sets` — goal (engagement/conversion/hybrid), assignment_mode (handpick/open_group)
- `campaign_influencers` — status machine: invited → accepted/negotiating → contracted → active → completed/declined/expired
- `deliverables` — type (reel/post/story/youtube_video/youtube_short), status machine: pending → submitted → under_review → revision_requested/approved → live
- `negotiations` + `negotiation_turns` — turn-based negotiation thread

### Products & Offers
- `brand_products` — AI menu import supported for restaurants
- `campaign_offers` — offer_type (flat/percentage/bogo/bundle/volume/prebook), availing_modes []

### Financial
- `wallet_transactions` — type (topup/escrow_lock/escrow_release/payout/refund/platform_fee)
- `escrow_entries` — tranche_number (1/2/3), trigger_event (contract_signed/content_live/day_30_post_live)
- `follower_transactions` — THE core attribution table; all 4 IDs (campaign/set/offer/influencer) on every transaction
- `influencer_withdrawals` — TDS deducted at withdrawal (10%, statutory)

### Follower App
- `follower_addresses`, `follower_orders`, `follower_bookings`, `enquiry_leads`

### Notifications
- `notifications` — user_id, type, title, body, data_json (deep-link params), is_read

---

## API (Section 3 of Spec)

**Base URL:** `https://api.inflx.in/v1`
**Auth:** Phone + OTP (MSG91) → JWT (RS256), access token 15min, refresh token 30 days (HttpOnly cookie)

Key endpoint groups:
- `/auth/*` — send-otp, verify-otp, refresh, logout
- `/brands/*` — register, profile, wallet, wallet/topup
- `/influencers/*` — register (triggers Apify scrape), search, earnings, withdraw
- `/campaigns/*` — CRUD, publish (validates wallet), sets, invite
- `/offers/*`, `/negotiations/*` — accept, decline, negotiate, counter-turn
- `/contracts/*`, `/deliverables/*` — sign, brand-sign, submit, review, submit-live, confirm-live
- `/follower/*` — pay-at-store, prebook, orders, enquiry, feed, follows
- `/store/:influencer_handle` — public (no auth), serves follower-facing store
- `/admin/*` — approval queues, escrow management, payment config, platform stats

**Tracking URL pattern:**
```
https://inflx.in/s/{influencer_handle}?cid={campaign_id}&sid={set_id}&oid={offer_id}&iid={influencer_id}
```
All 4 IDs are inherited on every follower transaction for automatic commission attribution.

---

## Payment Logic (Section 4 of Spec)

### Brand Wallet Rules
- Wallet must hold **full campaign budget** before publishing
- Funds locked in escrow on publish
- Top-up via Razorpay (UPI, cards, netbanking)

### Tranche Schedule (Admin-configurable)
| Tranche | Default | Trigger |
|---|---|---|
| T1 | 25% | Both parties sign contract |
| T2 | 25% | Brand confirms content live |
| T3 | 50% | 30 days after T2 trigger (automatic) |

### Platform Fee
- **8% default**, charged to BRAND (on top of agreed influencer fee)
- Influencer always receives full agreed amount
- TDS 10% deducted from influencer at withdrawal time (not at earning time)

### Commission Return Window
- 30 days — commission sits in `pending_balance` until window closes
- Daily cron at 00:01 IST moves confirmed commissions to `wallet_balance`

---

## RBAC (Section 5 of Spec)

| Role | Key | Access |
|---|---|---|
| Brand | brand | Brand mobile + web dashboard |
| Influencer | influencer | Influencer mobile app only |
| Follower | follower | Follower mobile / PWA |
| Admin Super | admin:superadmin | Full admin — all sections |
| Admin Reviewer | admin:reviewer | Approval queue, read-only profiles |
| Admin Finance | admin:finance | Escrow, payout queue, financial reports |

JWT payload includes `role`, `sub` (user_id), and role-specific IDs (brand_id / influencer_id / admin_role).

---

## Notification Matrix (Section 6 of Spec)

All push via Firebase FCM, critical events also via MSG91 SMS, all stored in `notifications` table.

Key triggers: account approval/rejection, offer accepted/declined, negotiation updates, contract signed, content submitted/approved/live, tranche releases, commission earned/confirmed, withdrawal processed, follower payment/booking/order events.

---

## Cron Jobs (Section 8 of Spec)

| Job | Schedule | Purpose |
|---|---|---|
| offer-expiry-check | Every 15 min | Expire 48h offers, notify brand |
| commission-confirm | 00:01 IST daily | Move pending_balance → wallet_balance |
| tranche-3-auto-release | 06:00 IST daily | Release T3 at Day 30 |
| apify-engagement-scrape | 06:00 IST daily | Refresh deliverable engagement stats |
| campaign-status-check | 00:05 IST daily | Mark completed campaigns |
| booking-reminder | 07:00 IST daily | 2h pre-booking push+SMS |
| low-wallet-alert | 09:00 IST daily | Alert brands with low wallet |

---

## Category Schema System (Section 10 of Spec)

- Schema JSON (~3KB) fetched from CDN at brand login, cached 24h
- One smart form renderer reads schema — adding a category = add one JSON file, zero code changes
- V1 categories: restaurant, bakery, salon, florist, packaged_food, car_rental, function_hall, wedding_planner, fashion_walkin, fashion_online
- Each category has a `buyer_config.json` on CDN that drives follower store layout

---

## Dev Environment Rules (Section 9 of Spec)

All services mocked locally. Production = swap `.env` values only.

| Service | Dev | Prod switch |
|---|---|---|
| OTP (MSG91) | OTP always `000000` | `OTP_MOCK=false` |
| Razorpay | Test mode, card `4111111111111111` | Live keys + KYC |
| Apify | Returns `/mocks/apify_instagram.json` | `APIFY_MOCK=false` |
| Firebase FCM | `console.log` payload | `FCM_MOCK=false` |
| Cloudflare R2 | Local `/tmp/inflx-uploads/` | Set R2 credentials |

---

## Standard API Response Format (Section 12 of Spec)

```json
// Success
{ "success": true, "data": { ... }, "meta": { "page": 1, "total": 42, "limit": 20 } }

// Error
{ "success": false, "error": { "code": "WALLET_INSUFFICIENT", "message": "...", "field": "..." } }
```

Key error codes: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `WALLET_INSUFFICIENT`, `OFFER_EXPIRED`, `WRONG_TURN`, `ALREADY_SIGNED`, `REVISION_LIMIT_EXCEEDED`, `STOCK_UNAVAILABLE`, `SLOT_FULL`, `RATE_LIMITED`, `INTERNAL_ERROR`

---

## Build Phases (Section 11 of Spec)

### Phase 1 — Core Infrastructure (Week 1-2)
Supabase + PostgreSQL schema, Node.js/Express boilerplate, JWT auth middleware, MSG91 OTP (mocked), user registration + role routing, admin approve/reject

### Phase 2 — Brand & Influencer Flows (Week 3-4)
Campaign CRUD, set CRUD, offer creation, wallet top-up (Razorpay test), publish → escrow lock, Apify scrape (mocked), offer inbox, accept/decline, 48h expiry cron, negotiation turn-based API

### Phase 3 — Contracts & Content (Week 5)
PDFKit contract generation, dual signing with timestamps, Tranche 1 queue, deliverable submission, brand review + revision loop, live confirmation + Tranche 2 queue

### Phase 4 — Follower App (Week 6-7) ✅ COMPLETE — 2026-03-26
Pay-at-store (Razorpay), pre-booking (calendar + advance), online order + tracking, enquiry lead capture, follow/unfollow + feed generation
- **78 new tests** across 7 test files (follower-store, pay-at-store, prebook, online-order, enquiry, commissions, follower-feed)
- **281/281 total tests pass** (Phase 1+2+3+4 — zero regressions)
- 26 new API endpoints across: /followers, /follower, /store, /business, /category, /brands/me/enquiries, /brands/me/campaigns/:id/conversions, /influencers/me/commissions
- New services: follower.service, transaction.service, booking.service, commission.service
- New controllers: follower.controller, transaction.controller, enquiry.controller, commission.controller
- Commission flow: follower pays → pending_balance (30-day window) → Phase 5 cron confirms to wallet_balance
- authenticateOptional middleware added for unauthenticated store endpoints

### Phase 6 — QA & Production Cutover (Week 9) ✅ COMPLETE — 2026-03-26
Full UI build across all 5 apps (Admin Web, Brand Web, React Native mobile with brand/influencer/follower roles)
- **Admin Web** (`packages/admin-web/`) — Next.js 14, port 3003: login, stats, approval queue (brands+influencers), brand/influencer profile views, escrow management with manual release, payment config display
- **Brand Web** (`packages/brand-web/`) — Next.js 14, port 3002: login with status routing (waiting/rejected), campaign list/creation (4-step wizard)/detail (4 tabs: overview/content/analytics/conversions), influencer browse+search, wallet+Razorpay top-up, notifications, escrow breakdown, enquiry leads
- **React Native Mobile** (`packages/mobile/`) — RN 0.73, role-based entry point; Auth screens (PhoneScreen, OTPScreen, WaitingScreen, RejectedScreen); Influencer app (HomeScreen earnings hero, OfferListScreen tabbed, EarningsScreen+TDS withdrawal, OfferDetailScreen); Follower app (FeedScreen, StoreScreen, PayAtStoreScreen); Brand app (placeholder tabs pointing to web)
- **Shared package** (`packages/shared/`) — API client (token-agnostic, localStorage for web / AsyncStorage for mobile), theme tokens (all colors/spacing/radius from mockups), shared components (OTPInput, StatusBadge, MoneyDisplay, Avatar, LoadingSpinner, ErrorMessage, EmptyState)
- **Backend additions**: GET /notifications, POST /notifications/read-all (any authenticated user)
- **New docs**: docs/RUNNING_LOCALLY.md, docs/TEST_ACCOUNTS.md, docs/ANDROID_SETUP.md, docs/MOBILE_TESTING.md

### Phase 5 — Crons, Analytics & Payouts (Week 8) ✅ COMPLETE — 2026-03-26
All 7 cron jobs, Tranche 3 auto-release, commission confirmation, influencer withdrawal via Razorpay Payout API, Apify engagement analytics, conversion analytics
- **30 new tests** across 7 test files (cron-commission-confirm, cron-tranche3, cron-campaign-status, cron-low-wallet, engagement, withdrawal, admin-escrow)
- **311/311 total tests pass** (Phase 1+2+3+4+5 — zero regressions)
- 7 cron jobs: commission-confirm, tranche-3-release, offer-expiry (existing), apify-engagement, campaign-status, booking-reminder, low-wallet-alert
- New services: withdrawal.service, engagement.service; extended: escrow.service (standalone T3), apify.service (post engagement)
- New controllers: withdrawal.controller, engagement.controller; updated: admin.controller (escrow overview, manual release, Phase 5 stats)
- New routes: withdrawal.routes, engagement.routes; updated: admin.routes, influencer.routes
- Updated earnings endpoint: available_to_withdraw, recent_withdrawals, tds_this_financial_year (Indian FY)
- TDS at withdrawal: 10% deducted, min ₹100 (10000 paise), RAZORPAY_MOCK=true for dev
- deliverable_stats table updated: added shares, engagement_rate, UNIQUE(deliverable_id)
- ENABLE_CRONS=false in test env prevents cron timers from leaking; jobs export run() for direct test invocation
- requireAnyAdminRole middleware added for all-admin endpoints (e.g. /admin/stats)

### Phase 6 — QA & Production Cutover (Week 9)
End-to-end test (brand → influencer → follower → payout), swap .env to production, load test (1,000 concurrent follower transactions), security audit (JWT, input validation, rate limiting, CORS), deploy to Railway + Vercel + Expo EAS

---

## Key Business Rules (Appendix B of Spec)

| Rule | Value | Configurable |
|---|---|---|
| Default platform fee | 8% of influencer fee | Yes — admin per brand |
| Tranche 1/2/3 split | 25% / 25% / 50% | Yes — admin global |
| Offer expiry | 48 hours | No |
| Commission return window | 30 days | No |
| TDS on withdrawal | 10% (statutory) | No |
| Minimum withdrawal | ₹100 | No |
| Max revision rounds | 2 (default) | Yes — per contract |
| Re-submission attempts | 1 | No |
| Min wallet to publish | Full campaign budget | No |
| T1 processing time | 24h after both signatures | No |
| T3 auto-trigger | 30 days after T2 trigger date | No |
