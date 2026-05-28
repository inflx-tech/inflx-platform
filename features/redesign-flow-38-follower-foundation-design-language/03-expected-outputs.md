# Flow 38 (F0) — Expected outputs

## Rendered output assertions

### HomeScreenV2 (flagship)
| Element | Expected |
|---|---|
| Background | `brandPalette.bg` (#FAFAFA) light |
| Header title | Outfit-Black ink "Vijayawada" |
| Header sub | mono uppercase muted "DEALS NEAR YOU" |
| Bell | bg2 circle |
| Search | ink 1.5px border, white bg |
| Story rings | yellow ring + ink avatar + yellow initial |
| Category tiles | per-business pale tint (eat=restaurant-pale, etc.) |
| Section titles | Outfit-Black ink |
| See-all | mono yellowText uppercase |
| Product cards | white, ink/yellow badge, creator note, mono price |
| Offer banner | ink bg + yellow accents |
| Tab bar | white, ink active, yellow MCI icons, mono labels |

### Shared atoms
| Atom | Expected |
|---|---|
| ProductCard | white card / per-business pale hero / ink+yellow badge / ink+yellow creator avatar / creator note quote / success verified / mono prices / yellowPale deal label |
| ServiceCard | white card / pale hero / ink+yellow badge / ink Book CTA / mono price |
| CategoryGrid | per-business pale tiles / ink count badge / mono labels |
| InfluencerStoryRow | yellow ring / ink avatar / yellow initial / ink deal badge |
| NewOfferCard | ink banner / yellow tag+discount / ink+yellow influencer strip |

### Tokens
- `getBusinessAccentLight('restaurant')` → `{ accent: '#E8401A', pale: '#FDEEE9', icon: '🍽️' }`
- `getBusinessAccentLight('fashion')` → pink; `'salon'` → purple; `'car_rental'` → blue
- Unknown key → `{ accent: yellowText, pale: yellowPale, icon: '🏪' }`
- `darkColors` + `businessAccents` still exported (additive — zero break)

### Dead code
- `HomeScreen.js`, `FollowerProfileScreen.js`, `FeedScreen.js`, `StoreScreen.js` no longer exist.
- No broken imports (verified: only the influencer HomeScreen import remains, different file).

## Data assertions
- ZERO API/behavior change — all followerApi calls, navigation routes, tracking unchanged.
- Atom prop APIs identical → consumers (CategoryList/Deals/Saved/BrandStore) still render (light-on-dark intermediate until F1).

## Visual evidence
`pnpm diff:open redesign-flow-38-follower-foundation-design-language`:
- before = mockup web.html at 390×800 (4 surfaces)
- after = founder physical smoke-test on installed APK (NATIVE_RUNTIME=2)
