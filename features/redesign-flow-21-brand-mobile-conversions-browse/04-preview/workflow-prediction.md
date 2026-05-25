# Workflow Prediction — Flow 21

## Conversions — tile → source

| Tile | Source |
|---|---|
| Summary: Transactions | `summary.total_transactions` |
| Summary: Revenue | `summary.total_revenue` (rupees) |
| Summary: Commission Paid | `summary.total_commission` (rupees) |
| Summary: Brand Net | `summary.total_brand_net` (rupees) |
| Channel: Walk-in count | `summary.pay_at_store_count` |
| Channel: Pre-book count | `summary.prebook_count` |
| Channel: Online count | `summary.online_order_count` |
| Filter chip: All/Walk-in/Pre-book/Online | param-only filter on `transaction_type` |
| Card: type label | `TYPE_LABELS[t.transaction_type]` |
| Card: follower_name + via @handle | `t.follower_name`, `t.instagram_handle` |
| Card: campaign_name (only when not campaign-filtered) | `t.campaign_name` |
| Card: product_name | `t.product_name` |
| Card: net_amount | `t.net_amount` (rupees) |
| Card: date | `t.created_at` (toLocaleDateString IN) |
| Detail: gross/discount/net/platform_fee/influencer_commission/brand_net | all rupee fields on `follower_transactions` |
| Detail: coupon_code_used, booking_ref, booking_date, booking_time, order_status, razorpay_payment_id, follower_phone | all preserved columns on follower_transactions table |

## InfluencerBrowse — tile → source

| Tile | Source |
|---|---|
| Search box + button | param `q` on `/influencers/search` |
| Sort chips (7) | param `sort` on `/influencers/search` (rank/view_er/followers/active/growth/cheapest/most_collabs) |
| Filter: niche | param `niche` |
| Filter: tier | param `tier` (nano/micro/macro/mega) |
| Filter: min_followers, min_er | params `min_followers`, `min_er` |
| Filter: city | param `city` |
| Card: avatar initials | first 2 chars of `instagram_handle` or `full_name` (uppercase) |
| Card: handle + verified | `inf.instagram_handle`, `inf.verified` (✓ tick) |
| Card: tier pill | `inf.tier` |
| Card: full_name | `inf.full_name` |
| Card: followers + ER | `inf.followers_count`, `inf.engagement_rate` (compact format) |
| Card: niche + city meta | `inf.niche` (array or scalar) + `inf.city` |
| Nav target | `navigation.navigate('BrandInfluencerProfile', { influencerId: inf.id })` |

## Behavioral preservation

| Behavior | Preserved |
|---|---|
| Conversions: useFocusEffect refetch on filter or campaign change | ✓ |
| Conversions: inline expand-collapse detail (no modal) | ✓ |
| Conversions: pull-to-refresh | ✓ |
| InfluencerBrowse: useFocusEffect on mount, pull-to-refresh, sort race-condition fix (pass new sort directly to load) | ✓ verbatim |
| InfluencerBrowse: response normalization (creators OR influencers) | ✓ verbatim |
| InfluencerBrowse: active-filter count derive | ✓ |
| InfluencerBrowse: Clear All resets all 6 filter fields | ✓ |

## Component contract (Flow 21 introduces)

### `<StatusPill status mode />`
- `status`: string from canonical map
- `mode`: optional, default 'default'. If `'transaction'`, `pending` → yellowPale/yellowText (Conversions context where pending = in-flight, not stale)

### `<EmptyState icon title sub />`
- `icon`: string placeholder text (e.g. `[$]`, `[NONE]`, `[BELL]`)
- `title`: short string
- `sub`: longer string, max ~260px wrap

### `<ScreenHeader title sub back onBack count countLabel />`
- `title`: string (rendered Outfit-Bold 22 white)
- `sub`: optional string (PJS muted-white)
- `back`: optional bool — show back affordance
- `onBack`: callback for back tap
- `count`: optional number — render count chip
- `countLabel`: optional string for chip suffix ("sets", "results", etc.)

## What's NOT extracted in Flow 21

- BottomSheet (Modal w/ backdrop) — used in Flow 20 modals but each has different structure; defer
- FilterChips (3 different shapes already observed: pill-strip vs sort-row vs niche-grid) — defer
- Card title + InfoRow — low value to abstract
- Multi-step modal state machine — Flow 22+ may surface a pattern
- Stats grid — only 2 uses so far (StorePreview 3-tile, InfluencerProfile 6-tile)
