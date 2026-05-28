# Flow 38 (F0) — Workflow prediction (mockup → backend source mapping)

The mockup is a design-language reference, not a data screen, but every tile
still traces to a real backend source consumed by the flagship HomeScreenV2.

## HomeScreenV2 tiles → source
| Mockup element | Backend source |
|---|---|
| Location "Vijayawada" | `useLocation()` hook (device) |
| Story rings | `followerApi.getStories()` → `{ stories: [{ id, name, handle, ring_state, active_deals }] }` |
| Category tiles | `followerApi.getCategories()` → `{ categories: [{ key, icon, label, deal_count }] }` |
| Hot/Trending product cards | `followerApi.getHomeFeed(page, loc)` → `{ items: [{ type, product, brand, discount, influencer, tracking }] }` |
| Offer banner | feed items where `type==='offer'` |
| Service cards | feed items where `type==='service'` |

## ProductCard fields → source
| Card element | Field |
|---|---|
| Hero image | `product.image_url` (category emoji fallback via `getBusinessAccentLight(brand.category).icon`) |
| Hero tint | `getBusinessAccentLight(brand.category).pale` |
| Discount badge | `discount.{type,value}` → `computeOfferBadge()` (5 wizard offer types) |
| Creator avatar | `influencer.{name, avatar_initial}` |
| Creator note | `product.influencer_note` (from influencer_product_notes) |
| Brand line | `brand.{name, locality, is_verified}` |
| Trust chips | derived from `brand.category` |
| Offer/MRP price | `product.price` (rupees) + computed pct |

## Per-business accent palette (NEW — light)
| Vertical | accent / pale |
|---|---|
| restaurant/bakery | #E8401A / #FDEEE9 |
| fashion family | #DB2777 / #FCE7F3 |
| salon/beauty | #7E22CE / #F3E8FF |
| car/bike rental | #1D4ED8 / #DBEAFE |
| (deferred 26) | yellowText / yellowPale |

## Zero phantom
Every tile traces to a real feed/store/category field. No invented metrics.
The 4 accent hues are design tokens, not data.
