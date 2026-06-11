# brand-mobile-parity-pack

> Founder walkthrough W4 + explicit go (2026-06-11): "ok pls carry with all 5
> missed things". Parity direction: brand mobile = brand web for EVERYTHING
> except listing and campaign creation (web-only by design).

## Gap (from the W4 code audit)

Five web dashboard features had no mobile counterpart: Orders inbox, Bookings
inbox, Meals daily board, Offer library, Billing/Subscription/Payout settings,
and Influencer market analytics. All backend endpoints already exist (web
consumes them) — this contract is pure mobile UI + navigation.

## Scope — six new screens, all reusing existing endpoints

1. **BrandOrdersScreen** — GET /brands/me/transactions; type (walk-in /
   pre-book / online) + status filters, expandable money breakdown
   (bill/discount/net/commission/via-creator), pagination.
2. **BrandBookingsScreen** — GET /brands/me/bookings?status=…; stats strip
   (pending/today/upcoming/7d revenue); confirm / reject actions.
3. **BrandMealsBoardScreen** — restaurant-gated (self-gates on brand.category).
   Today tab: /meals/dashboard stats + prep summary + orders + mark-delivered.
   Deals tab: /meals/offer-rules with party-size filter, accept→active /
   reject / archive, AI suggest. (Chat-builder, menu costs and delivery config
   stay web-only in v1 — setup tasks, not daily ops.)
4. **BrandOffersLibraryScreen** — GET/POST/PATCH/DELETE /brands/me/offers +
   attachments; status tabs with counts, activate / archive / publish-to-store,
   where-used sheet; creation for discount offers (pct/flat, store scope) —
   volume/BOGO/bundle/free-gift creation stays web (needs product pickers) but
   all are manageable here.
5. **BrandSettingsHubScreen** — subscription (plan, status, cycle, usage bars)
   + invoices (PDF opens in browser via download_token) + payout account
   (status / connect / route-to-Wallet). Plan UPGRADE links out to web
   (Razorpay mandate checkout needs the native SDK — phase 2).
6. **BrandInfluencerAnalyticsScreen** — GET /influencers/analytics with
   tier/city filters; overview tiles, tier/city/niche bars, rate benchmarks,
   leaderboards (tap-through to influencer profile).

Navigation: 5 screens in Home stack + Settings hub in Profile stack; Home
quick-actions grid expanded (Meals tile restaurant-only; Settings tile
cross-tab navigates).

## Out of scope (recorded, not forgotten)

Native Razorpay subscription checkout (phase 2); meals chat-builder + menu
costs on mobile; volume/BOGO/bundle/free-gift mobile builders; quick-actions
grid visual polish (goes to the D/U batched sweep).
