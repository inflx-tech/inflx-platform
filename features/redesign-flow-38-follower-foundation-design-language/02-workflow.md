# Flow 38 (F0) — Workflow

**Actor**: Follower (public user, may be anonymous or logged-in).

## A · Design language establishment (mockup)

Master HTML mockup at `design/wave3/flow-38-follower-foundation-design-language/web.html`
renders 4 representative surfaces in the locked language:
1. Unified Home — location header, ink-bordered search, yellow story rings, 4
   per-business-tinted category tiles, mixed product+service feed, ink+yellow
   offer banner, light tab bar with yellow active pill.
2. Brand Store — pale per-business hero, white store card, yellowPale creator-
   endorsement strip, menu grid, sticky ink+yellow CTA.
3. Product Detail (fashion) — bespoke variant layout, creator deal strip, mono
   price, ink/yellow Add-to-Cart.
4. Checkout — ink-active mode selector, creator-deal-applied strip, mono summary,
   ink+yellow PAY CTA, Razorpay note.

Locked design calls: light brandPalette chrome · creator vibe via content ·
4 restrained per-business accents (wayfinding only) · creator notes kept on cards
· one foundation flow.

## B · HomeScreenV2 flagship (live behavior — unchanged)

1. Mount → `Promise.all([getHomeFeed(page, loc), getStories(), getCategories()])`.
2. Feed split by item.type (product / offer / service).
3. Renders: location header + search → Find · InfluencerStoryRow → InfluencerStore ·
   CategoryGrid (eat→DiningHome, all→Find, else→CategoryList) · Hot Products grid ·
   NewOfferCard → BrandStore · Trending horizontal · Services horizontal → BrandStore.
4. ProductCard tap → CarDetail (car_rental) or ProductDetail (else), with
   `buildTracking(item)` forwarded.
5. Pull-to-refresh re-fetches.

**All navigation + data + tracking preserved verbatim** — only colors/fonts changed.

## C · Shared atoms (consumed across screens)

- **ProductCard** — white card, per-business pale hero, ink/yellow badge,
  ink/yellow creator avatar overlay, creator-note quote, mono prices. Props
  unchanged.
- **ServiceCard** — same chrome, ink Book CTA, mono price.
- **CategoryGrid** — per-business pale tiles via `getBusinessAccentLight`, ink
  count badge.
- **InfluencerStoryRow** — yellow rings, ink avatar + yellow initial.
- **NewOfferCard** — ink banner, yellow tag/discount, ink/yellow influencer strip.

## D · Tab bar (FollowerNavigator)

Light white bar + ink active / muted3 inactive + MCI icons (home-variant / tag /
bag-personal / account) + mono uppercase labels. Stack structure + screen
registrations UNCHANGED.

## E · Dead-code retirement

Delete HomeScreen, FollowerProfileScreen, FeedScreen, StoreScreen (unreferenced
legacy screens superseded by HomeScreenV2 / MeScreen).

## Success state

Follower opens the app → lands on a fully-coherent light creator-vibe Home with
the new design language; tab bar matches; all flows still function; subsequent
phases inherit the restyled atoms.
