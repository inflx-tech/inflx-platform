# Flow 38 (F0) — Impact

**Chat verdict (terse)**: zero functional / backend / logic / DB impact — visual
foundation + design-language establishment + dead-code retirement only.

## Files changed

| File | Change | Delta |
|---|---|---|
| `theme/tokens.js` | + `businessAccentsLight` + `getBusinessAccentLight()` (additive) | +44 |
| `components/cards/ProductCard.js` | dark → light brandPalette restyle | ~same |
| `components/cards/ServiceCard.js` | dark → light restyle | ~same |
| `components/cards/NewOfferCard.js` | ink+yellow banner restyle | ~same |
| `components/CategoryGrid.js` | light per-business pale tiles | ~same |
| `components/InfluencerStoryRow.js` | yellow rings + ink/yellow avatars | ~same |
| `screens/follower/HomeScreenV2.js` | flip to light brandPalette | ~same |
| `navigation/FollowerNavigator.js` | light tab bar + MCI icons | ~same |
| `screens/follower/HomeScreen.js` | DELETED (dead) | −215 |
| `screens/follower/FollowerProfileScreen.js` | DELETED (dead) | −174 |
| `screens/follower/FeedScreen.js` | DELETED (dead) | −88 |
| `screens/follower/StoreScreen.js` | DELETED (dead) | −122 |
| `features/redesign-flow-38-*/` | 7 contract artifacts | new |
| `design/wave3/flow-38-*/` | master mockup | new |

**Net source**: ~−600 LOC (dead-code retirement) + cosmetic restyle deltas.

## APIs touched
**ZERO** — atoms + Home keep all followerApi calls + navigation + tracking verbatim.

## Backend changes
**ZERO**.

## Regression surface
- `pnpm qa` 76 Playwright tests: zero Mobile-touching; expect 76/76 GREEN first-run.
- `pnpm qa:db`: unchanged.
- Maestro 4/4 baseline applies; `01-follower-public-browse.yaml` exercises follower
  boot — relevant here. Founder physical smoke-test on installed APK covers the
  light flip + tab bar.
- 4 follower screen-test files (FollowerWallet/RestaurantBill/RestaurantBooking/
  RestaurantCart) — none reference deleted screens → unaffected.

## Mobile-specific risks
- **Intermediate cascade mismatch**: ProductCard/ServiceCard now light; CategoryList/
  Deals/Saved/BrandStore (still dark) show light cards until F1. Accepted + bounded.
- **Atom prop compatibility**: all atoms keep identical prop signatures → no consumer
  break. `NewOfferCard` dropped the unused `accentColor` param (ignored if passed).
- **MCI icons in tab bar**: already baked into APK (Flow 28). No native rebuild.
- **getBusinessAccentLight additive**: dark screens still resolve `darkColors` +
  `businessAccents` — zero break.
- **Dead-code deletion**: verified-twice unreferenced.

## Deploy class
**Production-impacting** — mobile ships via OTA.
- ota:brand v86 (shared bundle; no brand-screen change)
- ota:influencer v75 (shared bundle; no influencer-screen change)
- ota:follower v49 (Home + atoms + tab live here)

Native rebuild: NOT required.

## Time estimate
- Mockup + lock: done · atoms + Home + tab + dead-code: done · artifacts: done ·
  QA + push + OTA + close-out: ~25 min.
