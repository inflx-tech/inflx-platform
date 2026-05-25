# Workflow Definition — Flow 21

## Actor
Logged-in brand on mobile app.

## Preconditions
- Conversions: 0+ follower_transactions for the brand (campaign-filtered or all)
- InfluencerBrowse: search endpoint reachable; v_searchable_creators view has rows

## Workflow steps

### Path A — Conversions
1. Brand opens screen → ink topbar via `<ScreenHeader title="Conversions" sub={campaignId ? 'Transactions for ${campaignName}' : 'Every transaction your influencers have driven'} back onBack={goBack} />`
2. Loading → centered yellow ActivityIndicator
3. Response arrives → 4-tile summary grid (Transactions / Revenue / Commission Paid / Brand Net), 3-tile channel breakdown (Walk-in / Pre-book / Online), filter chip strip (All / Walk-in / Pre-book / Online)
4. Transaction cards render with:
   - Type label (mono ink) + StatusPill (canonical)
   - Follower name + via @handle + (optional) campaign name + (optional) product name in yellowText
   - Right column: net_amount mono ink + date mono muted
5. Tap a card → expands inline detail block: gross/discount/net/platform_fee/commission/brand_net + coupon/booking_ref/etc.
6. Tap filter chip → re-fires `listTransactions({ type, campaign_id })` and useFocusEffect reload
7. Empty → `<EmptyState icon="[$]" title="No transactions yet" sub="..." />`

### Path B — InfluencerBrowse
1. Brand opens screen → `<ScreenHeader title="Find Influencers" sub="Search and invite to your campaigns" back onBack={goBack} />`
2. Search bar (white input + ink search button) below header
3. Sort chip strip (7 sorts; active = ink bg + yellow mono text)
4. Filter toggle row → tap expands a white card with niche chips + tier chips + min followers/ER inputs + city input + Clear/Apply buttons
5. Result cards: 44px yellow avatar circle + handle (Outfit) + tier mini-pill + full name + stats row (mono followers + ER) + niche/city meta + chev
6. Tap card → `navigation.navigate('BrandInfluencerProfile', { influencerId })`
7. Empty → `<EmptyState icon="[NONE]" title="No influencers match" sub="Try loosening filters" />`
8. Pull-to-refresh re-fires search with current state

## Success definition
- All behavior preserved (3 components don't change a single API call or assertion)
- New components live at `Packages/Mobile/src/components/brand/{StatusPill,EmptyState,ScreenHeader}.js`
- pnpm qa green
- Flows 18-20 untouched (their inline patterns still look identical to the new components by design)
