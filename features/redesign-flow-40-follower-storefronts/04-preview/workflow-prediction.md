# Flow 40 (F1) — Workflow prediction

Design authority = F0 master mockup, Surface 2 (Brand Store). Applies the
locked language; no new tiles.

## BrandStore tiles → source
| Element | Source |
|---|---|
| Banner / logo | `brand` (accent via getBusinessAccentLight(category)) |
| Name / verified | `brand.business_name / is_verified` |
| Open pill | `brand.is_open` / hours |
| Creator bar | `viaInfluencer` (Path-B attribution) |
| Trust chips | derived from category |
| Product grid | `getStoreProducts` → ProductCard |
| Sticky CTA | primary availing mode (book/order/pay) |

## InfluencerStore tiles → source
| Element | Source |
|---|---|
| Hero name/handle | `getStore(handle)` → influencer |
| Creator picks | published product notes |
| Offer/product cards | `getStoreProducts(handle, {offerId, ciId})` |
| Creator notes | `product.influencer_note` |

## Zero phantom
Every tile traces to a real store/brand/product field. Accent tints are design
tokens. No invented metrics.
