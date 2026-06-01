# Flow 52 — Expected outputs (Creator Vibe follower re-theme)

## Visual
- Follower app renders in cream `#F7F3EC` + terracotta `#8B4A2F` + ink `#1C1A17`
  with serif (system fallback) display titles across the core journey.
- Bottom nav shows 5 items: Home · Offers · 🎬 Reels (center FAB) · Orders ·
  Profile, with a terracotta active tint.
- Brand-web and mobile-brand are visually UNCHANGED (creatorVibe is additive;
  shared palettes untouched).

## Functional (must be unchanged — regression guards)
- Every follower API call resolves as before (`getHomeFeed`, `getStories`,
  `getCategories`, `getDeals`, `getStore`, `getBrandStore`, `getStoreProducts`,
  `getCategoryStores`, save/unsave, follow/unfollow).
- `availing_modes` → CTA dispatch unchanged (pay-at-store / pre-book / online-order
  / book / enquiry) with category-aware verbs.
- 4-ID tracking flows through every offer/product tap → commission attribution
  intact.
- Discount math (percentage/flat/bogo/bundle/volume/gift) unchanged.
- Navigation graph: all prior routes reachable; new `CreatorCategory` route added.

## New surface
- Tapping a category inside a Creator Store opens `CreatorCategoryScreen` showing
  ONLY that creator's partner businesses + picks in that category (client-side
  filter of `getStore` offers; no new endpoint).

## Acceptance evidence
- `pnpm qa` STATE=GREEN, 76/76, gate 0 (web regression-free).
- Babel transform PASS on every touched file (Mobile metro preset).
- Integrity greps: 0 orphaned old-palette imports in scope; all logic markers
  present per screen.
- Maestro mobile E2E green (pre-release) + founder physical-APK smoke.
