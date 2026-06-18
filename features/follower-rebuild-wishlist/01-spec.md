# 01 — Spec: Wishlist (SavedScreen) reskin

**Slug:** `follower-rebuild-wishlist`
**Track:** Follower visual rebuild (Creators Vibe Yellow). Continuation of Phase 5
(5a palette → 5f sweep). Next remaining reskins = Wishlist + Account.
**Governance class:** UI-governed + Mobile-governed (RN screen). Mobile-only OTA.
No backend / migration / API change.

## What
Reskin `Packages/Mobile/src/screens/follower/SavedScreen.js` to the Creators Vibe
Yellow aesthetic (source screen 10 "Wishlist"), adapted to the **real** data the
screen already loads.

## Reality (backend-first — verified in code)
- Data source = `followerApi.getSavedOffers()` → `GET /follower/saved`. Items are
  **saved OFFERS**, not bare products. Each item: `{ offer_id, offer_type,
  discount_value, availing_modes, brand{id,name}, products[], influencer{handle},
  tracking }`.
- Mutations available: `unsaveOffer(offer_id)` (DELETE `/follower/saved/:id`). No
  saved-products endpoint exists → the screen stays offer-based (no phantom feature).
- Nav: registered as `SavedList` **inside the Profile stack**
  (`FollowerNavigator.js:140`), reached from MeScreen's "Saved Offers" row. It is a
  **pushed sub-screen**, not a tab → needs a back affordance (current screen has none
  = a real gap fixed here). Persistent bottom tab bar shows Profile active.
- Real follower tabs = Home / Offers / Reels(center FAB) / Orders / Profile. (Source
  mockup's Home/Shop/Wishlist/Cart/Account tab row is NOT the real app — not adopted.)

## Source → reality adaptations (the decisions to lock)
1. **2-column grid** (source is 3-col bare tiles). Reason: real tiles carry more —
   discount badge + brand + ₹ price + "via @creator" — 3-col would be cramped.
2. **Enriched tile** keeps source visual language (rounded image, white circular
   heart top-right = unsave, name, price) and adds, only where the data has it:
   a discount badge (from `offer_type`/`discount_value`), brand name, struck
   original price, and a "via @handle" attribution line (preserves the offer's
   `tracking` → commission attribution on eventual purchase).
3. **Header** = back chevron + "My Wishlist (N)". Source's "Edit" link dropped —
   per-tile heart already removes; no phantom multi-select.
4. **Tap behavior** (unchanged from today): tap tile → primary CTA dispatch
   (default `ProductDetail`, carrying offer + tracking + influencer); heart → unsave;
   brand row → BrandStore; creator → InfluencerStore.
5. **Empty state** restyled to gold/cream (gold blob + heart + "Browse offers" CTA).
6. **Currency = ₹** (rupees), not the source's `$`.

## Out of scope
Backend, the offer save/unsave API, the OfferCard component used elsewhere, the
Account (MeScreen) reskin (separate contract), FindScreen.

## Reference
Mockup: `04-preview/mockups/wishlist-recolored.html` (populated + empty states).
Source: `CREATORS VIBE Yellow -standalone- (1).html` screen 10.
