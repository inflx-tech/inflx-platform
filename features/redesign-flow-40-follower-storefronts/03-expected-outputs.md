# Flow 40 (F1) — Expected outputs

## BrandStoreScreen
| Element | Expected |
|---|---|
| bg / cards | light brandPalette (P.bg / white) |
| banner | accent.pale tint |
| logo | accent.accent bg + white initial |
| store name | ink |
| verified badge | green #22C55E + white check |
| open pill | green-tint open / white-border closed |
| creator bar | accent.accent bg + white text ("brought to you by") |
| trust/creator chips | accent-tinted |
| product grid | light ProductCard (cascade cleared) |
| sticky CTA | accent.accent bg + white text |
| spinner/refresh | yellow |

## InfluencerStoreScreen
| Element | Expected |
|---|---|
| hero name | Outfit-Black ink |
| handle | mono muted |
| follow btn | brand yellow / ink |
| creator-pick icon tiles | accent.pale |
| yellow accents | brand #FFC107 (was #EAB308) |
| creator notes | sansMedium italic |

## Data assertions
- ZERO behavior change. getBrandStore / getStore / getStoreProducts / follow /
  unfollow / saveOffer / unsaveOffer unchanged.
- BrandStore inline RestaurantDetail render preserved.
- Path-B 4-ID tracking forwarded unchanged.

## Visual evidence
`pnpm diff:open redesign-flow-40-follower-storefronts` — before = F0 master
mockup (Surface 2 = brand store); after = founder physical APK smoke-test.
