# Feature Spec — Follower Creator Store rebuild (Creator-Vibe)

> UI-governed (Mobile). Rebuild the Creator Store to its locked comprehensive mockup.
> Screen #4 of the follower redesign. Also the storefront the commission test shops.

## Problem / goal
The Creator Store (`InfluencerStoreScreen`) wears an older layout (ink hero + category
grid + hot-picks list). Rebuild it to
`design/wave4-creator-vibe/creator-store-comprehensive.html` — one template that
auto-fills from each creator's own data.

## Scope (in)
Driven by `followerApi.getStore(handle)` → `{ influencer, offers }`:
- **Top bar:** ← back · ↗ share.
- **Profile hero:** gradient-ring avatar (image/initial) · @handle ✓ · role · 3 counters
  (followers / collabs / picks) · Follow + Share · italic bio.
- **My Store Collabs:** the distinct partner brands (circles) → BrandStore.
- **Sticky category tabs:** the verticals this creator covers → filter the picks.
- **What {creator} Promotes:** their live picks (vibe `DealCard` rail), respects the tab.
- **Top Picks 🔥:** best by discount, ranked (RankBadge).
- Reels note (coming with the Reels feature).
- Every pick tap carries the creator's 4-ID tracking → PayAtStore/PreBook/Enquiry/BrandStore.

## Scope (out)
- Backend changes — none (reads the existing store endpoint).
- Store-context purchase attribution (the money slice) — wired separately.
- Admin Creator-Store template (brand-web) — follow-up; the layout is the global template.

## Surfaces
- Mobile follower only (`screens/follower/InfluencerStoreScreen.js`). Reuses
  `vibe/{DealCard,ShelfHeader,Gradient}` + palette.

## Non-functional
- OTA-safe (pure JS). NATIVE_RUNTIME unchanged ('3'). Degrades to an empty-picks state.
- Release = OTA `publish-ota:follower`. Reversible by revert + re-publish.
