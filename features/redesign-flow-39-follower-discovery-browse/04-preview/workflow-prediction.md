# Flow 39 (F1) — Workflow prediction

Design authority = F0 master mockup (mirrored in 04-preview/mockups/web.html).
This flow applies the locked language; no new tiles introduced.

## FindScreen tiles → source
| Element | Source |
|---|---|
| Super-category list | static SUPER_CATEGORIES const (7) |
| Deal counts | `followerApi.getCategories()` → `categories[].deal_count` |

## CategoryListScreen tiles → source
| Element | Source |
|---|---|
| Stores | `followerApi.getCategoryStores(superCategory, {sub_category})` → `stores[]` |
| Dining card name/cuisine/cost | `store.business_name / cuisines / cost_for_two` |
| Deal badge | `store.offers[0].discount_value` |
| Hero tint | `getBusinessAccentLight(store.category).pale` |
| Product grid | ProductCard (light atom, F0) |

## DealsScreen tiles → source
| Element | Source |
|---|---|
| Deal grid | `followerApi.getDeals(tab, page)` → items → ProductCard |

## Zero phantom
Every tile traces to a real backend field or static config. Accent tints are
design tokens. No invented metrics.
