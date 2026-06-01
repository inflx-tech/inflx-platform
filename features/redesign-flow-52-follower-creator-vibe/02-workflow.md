# Flow 52 — Workflow (Creator Vibe follower re-theme)

## Actors
Follower (the only user-facing actor for these screens).

## Trigger
Founder green-signalled the Creator Vibe mockup in chat (2026-06-01) and chose
D1 = OTA-safe serif fallback, D2 = Reels deferred, Step-5 = lock & build.

## Sequenced workflow (each sub-flow: implement → babel+integrity → pnpm qa → diff)
1. **52.0 Foundation** — add `creatorVibe` token block + `serifDisplay` fallback;
   restructure `FollowerNavigator` to 5 tabs (Home · Offers · 🎬 Reels · Orders ·
   Profile) with a center Reels FAB; add `ReelsScreen` placeholder. Preserve all
   existing stack routes; fix the dead `SavedList` route.
2. **52.1 Home** — repaint `HomeScreenV2`; recolor the 5 shared cards
   (`ProductCard`/`ServiceCard`/`NewOfferCard`/`CategoryGrid`/`InfluencerStoryRow`)
   once — they cascade to Category/Offers/Business.
3. **52.2 Offers** — `DealsScreen`: rename, terracotta chips, data-backed
   best-deal hero.
4. **52.3–52.6** — repaint `BrandStoreScreen`, `ProductDetailScreen`,
   `InfluencerStoreScreen`, `CategoryListScreen`.
5. **52.7 Creator's Category** — NEW `CreatorCategoryScreen`; wire `CreatorCategory`
   route; point the Creator Store category tap at it.
6. **52.G mid-flow gaps** — recolor `MeScreen`/`FindScreen`/`SavedScreen`/
   `OfferCard` + transaction screens (`PayAtStore`/`PreBook`/`OnlineOrder`/
   `OrderCart`/`Enquiry`) so the journey has no yellow clash.

## Expected end state
Follower can navigate Home → category/creator/business → product → transact, with
a coherent cream/terracotta look throughout the core journey, the 5-tab nav, and a
new creator-scoped category surface — with **zero functional change** to any API
call, `availing_modes` CTA dispatch, 4-ID tracking, discount math, or navigation
graph. Proven by `pnpm qa` GREEN (web regression-free) + babel transform +
integrity greps per screen; Maestro mobile E2E before release.

## Deferred (own contracts)
52.8 Reels (video backend + native player); deeper surfaces (dining sub-app, car
flow, wallet, returns, lookbooks, login, slot-picker, schema detail, meals-chat).
