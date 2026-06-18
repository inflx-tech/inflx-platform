# 06 — Before / after diff

**File changed:** `Packages/Mobile/src/screens/follower/SavedScreen.js` (mobile-only, OTA).

## Before
- Single-column list of full `OfferCard`s (image + influencer strip + price + CTA row).
- Header "Saved" with a count, **no back affordance** (a real nav gap — it's a Profile
  sub-screen).
- Legacy `darkColors`→creatorVibe remap shim at top of file.

## After (per locked mockup `04-preview/mockups/wishlist-recolored.html`)
- Gold/cream **2-column tile grid** (`numColumns={2}`, `width:48%`): rounded image,
  white circular **heart = unsave** (terracotta ♥), terracotta **discount badge**
  (from `offer_type`/`discount_value`), brand (muted caps), product name, ₹ price +
  struck original when discounted, gold **"via @handle"** line (when influencer present).
- Header: **← back** (→ `goBack`) + "My Wishlist (N)".
- Empty state: cream blob + ♥ + "Nothing saved yet" + "Browse offers" CTA (→ `OffersTab`).
- Uses `creatorVibe` tokens directly (shim removed).

## Functional parity (verified by reading, unchanged contracts)
- `getSavedOffers()` populate · `unsaveOffer(offer_id)` optimistic remove · tile tap →
  CTA dispatch (`ProductDetail`/`PayAtStore`/`PreBook`/`Enquiry`) with offer + tracking
  + influencer · brand → `BrandStore` · creator → `InfluencerStore` · pull-to-refresh.
- Discount label/price math mirrors `OfferCard` (percentage/flat/bogo/bundle/volume/prebook).
- Conditional rendering: no discount → no badge/struck price; no influencer → no via-line.

## Verify
- `node --check` SavedScreen.js → SYNTAX OK.
- `OffersTab` confirmed a real tab name (FollowerNavigator.js:198).
- `pnpm qa` from repo root → (result recorded at push time; mobile change inert to
  web/api/db lanes).
- Screenshot of `SavedList` vs mockup → to attach on device-verify.
