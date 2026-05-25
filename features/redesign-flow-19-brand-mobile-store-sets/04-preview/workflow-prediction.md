# Workflow Prediction — Flow 19 · brand-mobile Store Preview + Campaign Sets List

> Per `feedback_backend_first_tiles`: every visible tile/metric/chip traces to a real backend field or computed-from-real-fields. Verified via reading the controller wiring + the existing screens' consumed fields.

## StorePreview — section → backend source

| Mockup section | Source | Verified? |
|---|---|---|
| Topbar "My Store" + sub | Hardcoded UI | n/a |
| Brand initial tile | `brand.business_name[0]` | ✓ existing field |
| Brand name | `brand.business_name` | ✓ |
| Verified ✓ badge | Unconditional (preserved current behaviour — every approved brand on the platform is implicitly verified by virtue of being live) | ✓ preserved |
| Brand category | `brand.category` (snake_case → human via `.replace(/_/g, ' ')`) | ✓ |
| Brand city | `brand.city` (resolved server-side via `followerService.resolveBusinessStore`; underlying DB field lives on `users` table per CLAUDE.md but the endpoint flattens it onto the response) | ✓ preserved consumption |
| Stats: products count | `products.length` | ✓ |
| Stats: sections count | `Object.keys(groupBy(products, 'section')).length` | ✓ derived |
| Stats: creators count | `influencers.length` | ✓ |
| Creators row | per `inf` in `influencers`: `name`, `instagram_handle`, `offers.length` | ✓ existing fields |
| Product card image | `p.image_url` (R2 signed URL) or fallback to `CATEGORY_EMOJI[category]` | ✓ |
| Product card price | `fmtMoney(parseFloat(p.price))` (rupees per migration 021) | ✓ |
| Empty state copy | Hardcoded UI ("No products yet. Add products from your web dashboard…") | n/a |

## CampaignSetsList — section → backend source

| Mockup section | Source | Verified? |
|---|---|---|
| Topbar back-pill "← campaign name" | `campaign.name` | ✓ |
| Topbar title "Campaign sets" + crumb | Hardcoded UI + `campaignId.slice(0, 8)` | ✓ |
| Topbar count chip "N sets" | `sets.length` | ✓ |
| Set card name | `set.name` | ✓ |
| Set card window | `set.window_start`, `set.window_end` (timestamptz, formatted via `formatDate`) | ✓ |
| Set card budget | `set.set_budget || set.budget` (rupees per migration 021, `fmtRupees`) | ✓ both fields preserved as fallback |
| Goal badge | `set.goal` enum (engagement/conversion/hybrid) → GOAL_BADGE map | ✓ |
| Open-group funnel: Broadcast | `inf.length` (total broadcast count) | ✓ derived |
| Open-group funnel: Applied | `inf.filter(ci => ci.status === 'applied').length` | ✓ derived |
| Open-group funnel: Approved | `inf.filter(ci => ['accepted', 'contracted', 'active', 'completed', 'live'].includes(ci.status)).length` (out of `set.max_cap`) | ✓ derived |
| Mini-roster status dot | `STATUS_DOT[ci.status]` map → brandPalette colour | ✓ |
| Mini-roster influencer name | `ci.influencer_name` | ✓ |
| Mini-roster handle | `ci.instagram_handle` (mono font) | ✓ |
| Mini-roster status text | `ci.status.replace(/_/g, ' ')` (capitalize) | ✓ |
| "+N more" count | `visible.length - roster.length` (after OPEN_GROUP_HIDDEN filter) | ✓ derived |
| "View all" CTA → nav | `navigation.navigate('BrandCampaignInfluencersList', { campaignId, setIdFilter: s.id })` | ✓ existing nav target |
| Empty state copy | Hardcoded UI | n/a |
| "Campaign not found" error | Triggered when `!campaign` after load | ✓ existing branch |

## Behavioral preservation

| Behavior | Implementation | Preserved? |
|---|---|---|
| `useFocusEffect` re-fetch on focus return | `setLoading(true); load()` inside useFocusEffect | ✓ verbatim (SetsList only) |
| `goBack()` from StorePreview | `navigation.goBack()` on back arrow tap | ✓ verbatim |
| Pull-to-refresh both screens | `RefreshControl` re-fires `load()` | ✓ verbatim |
| Open-group funnel hidden filter | `OPEN_GROUP_HIDDEN = new Set([invited, declined, rejected_by_brand, expired, slots_filled])` removed from mini-roster | ✓ verbatim |
| Mini-roster cap at 5 + "+N more" | `inf.slice(0, 5)` + `inf.length - 5` | ✓ verbatim |
| Section grouping in StorePreview | `for (p of products) sections[p.section || 'Products'].push(p)` | ✓ verbatim |
| Category emoji fallback for missing images | `CATEGORY_EMOJI[category] || '📦'` | ✓ verbatim |

## What is NOT in this flow

- Adding edit affordances to StorePreview (intentionally read-only)
- Adding filter chips or search to SetsList (not in current scope; future flow could add)
- Per-set delete/edit actions (web dashboard handles this; mobile is view-only)
- Bulk operations on sets
- Real-time updates (relies on pull-to-refresh + focus refetch)
