# Feature Spec — Flow 21 · brand-mobile Conversions + InfluencerBrowse + component extraction

> Fourth flow of the mobile-brand bucket. **First flow to introduce shared components** under `Packages/Mobile/src/components/brand/`. Builds on Flows 18-20's `brandPalette` + canonical status-pill map.

## Problem / goal

After Flow 20, 6 screens (Flows 18-20) inline the same 3 patterns repeatedly:
- Ink topbar with title + yellow rule + optional sub/back/count
- 6-canonical-token status pill map (already a const in Flow 20)
- Dashed-yellow empty state with tile + Outfit title + PJS sub

Two new screens in this flow (Conversions + InfluencerBrowse) would inline the same patterns again — diminishing returns on duplication. Extract them once, consume from the 2 new screens. Defer retroactive migration of Flows 18-20.

Both screens currently navy + orange legacy:
- **BrandConversionsScreen** (277 LOC) — navy header + 4 status hex literals (#ECFDF5, #FFF7ED, #FEF2F2, #F3F4F6) + navyPale channel tiles + orange product label.
- **BrandInfluencerBrowseScreen** (363 LOC) — navy header + orange avatar circles + navy sort chips active + navyPale tier badges + navy stat text.

## Scope

**In scope:**
- **NEW components** under `Packages/Mobile/src/components/brand/`:
  - `StatusPill.js` — `<StatusPill status="..." />` with canonical 6-token map (yellowPale/infoPale/convPale/successPale/dangerPale/bg2). Single source of truth for status colours across the bucket.
  - `EmptyState.js` — `<EmptyState icon="[X]" title="..." sub="..." />`. Dashed-yellow border card.
  - `ScreenHeader.js` — `<ScreenHeader title sub back onBack count />` with variants. Replaces inline ink topbar markup.
- **Visual rewrite** of `BrandConversionsScreen.js` to consume the 3 new components + brandPalette
- **Visual rewrite** of `BrandInfluencerBrowseScreen.js` to consume the 3 new components + brandPalette
- Preserve all behavior: filter chips (Conversions), useFocusEffect, expandable transaction detail, sort dropdown, expandable filter card, search submit, response normalization (`creators` || `influencers`)

**Explicitly out of scope:**
- `theme/tokens.js` changes (brandPalette covers all)
- Retroactive migration of Flows 18-20 to consume the new components (deferred to a "polish" pass — those screens stay inline, visually identical)
- Extracting `BottomSheet`, `FilterChips`, `Card` (less reusable, more variance per use — wait for more screens)
- Backend / API changes

## Surfaces touched

- **App(s)**: mobile-brand (2 screen files + 3 new component files)

## Data / contracts

- **Tables / migrations**: none
- **API endpoints**: none changed; consume existing:
  - GET `/v1/transactions` (campaign_id, type filters; returns `{ transactions, summary }`)
  - GET `/v1/influencers/search` (q, niche, tier, city, min_followers, min_er, sort, limit; returns `{ creators }` from v_searchable_creators view OR legacy `{ influencers }`)
- **Money/units**: gross_amount, net_amount, platform_fee, influencer_commission, brand_net, total_revenue, total_commission, total_brand_net — all rupees per migration 021 (`fmtMoney`)

## Non-functional

- **Auth/role gates**: unchanged
- **Failure modes**:
  - Conversions: empty list → `<EmptyState icon="[$]" title="No transactions yet" sub="..." />`; missing summary → tiles hidden gracefully
  - InfluencerBrowse: zero results → `<EmptyState icon="[NONE]" title="No influencers match" sub="Try loosening filters" />`; legacy response shape preserved via normalization
  - Network failure → ActivityIndicator clears, list stays empty until refresh
