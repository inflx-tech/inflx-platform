# Flow 39 (F1) — Expected outputs

## FindScreen
| Element | Expected |
|---|---|
| bg | brandPalette.bg light |
| title / category labels | Outfit-Black ink |
| search | ink 1.5px border |
| deal-count badge | yellowPale + mono yellowText |
| category / sub cards | white + border |

## CategoryListScreen
| State | Expected |
|---|---|
| Dining super-cat | white dining cards, per-business pale hero, accent deal badge (white text), open/closed pill |
| Shopping super-cat | 2-col light ProductCard grid |
| Booking super-cat | grid → CarDetail/ProductDetail |
| Sort filters | light chips |
| Tap store/product | navigate w/ tracking forwarded (unchanged) |

## DealsScreen
| State | Expected |
|---|---|
| Loading | yellow ActivityIndicator |
| Tabs | inactive muted; active = ink border + yellowPale bg + ink text |
| Grid | light ProductCard 2-col |
| Refresh | yellow tint |

## Data assertions
- ZERO behavior change. getCategoryStores / getCategories / getDeals unchanged.
- CategoryList dining/shopping/booking split + routing preserved.
- buildTrackingFromOffer forwarded unchanged.

## Visual evidence
`pnpm diff:open redesign-flow-39-follower-discovery-browse` — before = F0 master
mockup (design authority); after = founder physical smoke-test on installed APK.
