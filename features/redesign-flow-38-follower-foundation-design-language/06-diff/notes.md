# Flow 38 (F0) — Before/After diff notes

## Before
Follower app ran 3 visual systems. Home-cluster on **darkColors** (Wave 3):
- HomeScreenV2: `darkColors.bg2` ink-black bg, amber accents, emoji header
- ProductCard / ServiceCard: `darkColors.card` dark cards, `getBusinessAccent`
  dark dims, amber price, dark creator overlay
- CategoryGrid: dark card tiles, amber count badge
- InfluencerStoryRow: amber rings, amber avatar bg, white initial
- NewOfferCard: per-business dim gradient bg
- Tab bar: `darkColors.card` dark bar, amber active, emoji icons
- 4 dead legacy screens (HomeScreen/FollowerProfileScreen/FeedScreen/StoreScreen)

## After (light brandPalette + creator vibe)
| Surface | After |
|---|---|
| HomeScreenV2 | `brandPalette.bg` white bg · Outfit-Black ink title · mono uppercase location sub · bg2 bell · ink-bordered search · Outfit-Black section titles · mono yellowText see-all |
| ProductCard | white card + #E4E4E7 border · per-business pale hero tint (wayfinding) · **ink-bg + yellow-text discount badge** · white heart (danger when saved) · **ink pill + yellow creator avatar** overlay · creator-note italic quote (kept) · mono brand + success ✓ · border trust chips · **mono ink price** + struck mono MRP · yellowPale deal label |
| ServiceCard | white card · pale hero · ink+yellow badge · ink+yellow creator avatar · mono price + unit · **ink+yellow Book CTA** |
| CategoryGrid | per-business pale tiles (eat=red-pale, fashion=pink-pale, beauty=purple-pale, car=blue-pale) · ink+yellow count badge · mono uppercase labels |
| InfluencerStoryRow | **yellow story rings** · ink avatar + **yellow initial** · ink+yellow deal badge · dashed muted "More" |
| NewOfferCard | **ink banner** + yellow glow · yellow tag · Outfit-Black white store name · yellow discount % · **ink+yellow influencer strip** |
| Tab bar | white bar · ink active / muted3 inactive · **MCI icons** (home-variant/tag/bag-personal/account) · mono uppercase labels |
| Dead code | 4 screens deleted (~600 LOC) |

## Per locked design call
| # | Decision | Implementation |
|---|---|---|
| 1 | Light brandPalette flip | All home-cluster atoms + Home + tab → white/yellow/ink + Outfit/PJS/Mono |
| 2 | Keep 4 per-business accents (wayfinding) | `getBusinessAccentLight` → pale tints on category tiles + card hero ONLY; chrome/CTAs stay ink+yellow |
| 3 | Keep creator notes on cards | ProductCard `creatorNote` quote retained |
| 4 | One foundation flow | atoms + Home + tab + dead-code shipped together as Flow 38 |

## Preservation evidence
- ALL followerApi calls + navigation routes + `buildTracking` 4-ID spine unchanged.
- Atom prop APIs identical → CategoryList/Deals/Saved/BrandStore (still dark, restyled in F1) consume without break.
- `darkColors` + `businessAccents` exports retained (additive) → dark screens unaffected.
- `computeOfferBadge` (5 wizard offer types) preserved verbatim in ProductCard.
- Razorpay flows + schema engine untouched.

## Open items (documented, deferred)
- Nav-registration gap for RestaurantDetail/OrderCart/SlotPicker/SchemaDetail/RestaurantBill/RestaurantBooking → F3/F4.
- Two StatusPill components → resolve in F4.

## Cascade note
ProductCard/ServiceCard are now light but CategoryList/Deals/Saved/BrandStore stay
dark until F1 (immediate next flow) → light-card-on-dark intermediate, bounded +
founder-smoke-tested before real-user impact.

## Sign-off
- Mockup locked 2026-05-27 (founder · 3 design calls via AskUserQuestion).
- Web QA: see lock.json. OTA: see lock.json.
