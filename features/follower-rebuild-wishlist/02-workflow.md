# 02 — Workflow

## User flow (unchanged behavior, restyled surface)
1. Follower opens Profile tab → taps "Saved Offers" row → `SavedList` (this screen).
2. Screen calls `getSavedOffers()` on focus → renders the saved offers as a 2-col
   gold/cream tile grid. Count shows in the header "My Wishlist (N)".
3. Tap a tile → primary CTA dispatch (default `ProductDetail`) with offer + tracking
   + influencer params (commission attribution preserved).
4. Tap the filled heart on a tile → `unsaveOffer(offer_id)` → tile removed optimistically,
   count decrements.
5. Tap brand name → `BrandStore`; tap "via @creator" → `InfluencerStore`.
6. Pull-to-refresh re-fetches. Empty list → gold empty state with "Browse offers" CTA
   (navigates to the Offers tab).
7. Back chevron → pop to Profile.

## Implementation steps
- Rewrite `SavedScreen.js` layout: header (back + title + count), `FlatList` with
  `numColumns={2}` rendering a new inline `WishlistCard` (image, heart, optional
  discount badge, brand, name, price + struck original, optional via-creator).
- Derive per-tile display from existing item fields (product[0] for image/name/price;
  `offer_type`/`discount_value` for the badge; `influencer.handle` for via-line).
- Keep all existing handlers (`handleUnsave`, `handleCTA`, brand/influencer nav).
- Use `creatorVibe` tokens directly (drop the local `darkColors` remap shim).
- Empty + loading states restyled to gold/cream.

## Verify
- `node`/metro bundle compile (mobile syntax gate).
- `pnpm qa` from repo root → expect 79 passed, STATE=GREEN, gate 0 (this is a
  mobile-only change → inert to web/api specs; classify any flake).
- 06-diff: Maestro or manual screenshot of `SavedList` vs the locked mockup.
