# Workflow Definition — Flow 19 · brand-mobile Store Preview + Campaign Sets List

## Actor

Logged-in brand on the mobile app, role-routed past Home.

## Preconditions

- **StorePreview**: brand profile completed with at least 0+ products in the listing engine; optional 0+ influencers contracted with active offers
- **SetsList**: at least one published campaign with at least 0+ sets (handpick or open_group)
- Backend `/brands/me/store-preview` and `/campaigns/:id` reachable
- `brandApi.getMyStorePreview` and `brandApi.getCampaign` wired (already in place — verified)

## Workflow steps (user-observable)

### Path A — Store Preview

1. Brand navigates to BrandStorePreviewScreen → ink topbar appears with back arrow + "My Store" title + sub-line "This is what customers see"
2. Loading → yellow ActivityIndicator centered against BG
3. Response arrives → brand-card section renders (logo tile + name + verified ✓ + category + city)
4. Stats strip below: products count / sections count / creators count (mono digits, ink)
5. If `influencers.length > 0` → "Creators on your store" section with per-creator row (avatar + name + handle + "N offers" pill)
6. Products grouped by section → 2-col grid per section, each card shows image OR category emoji fallback + name + price
7. If `products.length === 0` → empty state: dashed-yellow card with [STORE] tile + "No products yet" + sub-copy + (no CTA — products are added from web)
8. Pull-to-refresh → re-fires `getMyStorePreview`, refresh control yellow-tinted
9. Brand taps back arrow → `navigation.goBack()`

### Path B — Campaign Sets List

1. Brand reaches BrandCampaignSetsListScreen via `navigation.navigate('BrandCampaignSetsList', { campaignId })` from CampaignDetail
2. `useFocusEffect` triggers `getCampaign(campaignId)` on mount and re-focus
3. Ink topbar: small back-pill "← {campaign.name}" + "Campaign sets" title + crumb path + count chip "N sets"
4. Per-set card renders:
   - Set name (Outfit) + window dates (mono "DD MMM → DD MMM") + budget (mono yellow-text rupees)
   - Goal badge (engagement/conversion/hybrid) — small pill in matching pale + dot
   - Open-group funnel (only when `influencer_mode === 'open_group'`): 3 cells Broadcast / Applied / Approved (mono ink digits, bg2 strip)
   - Mini-roster: up to 5 influencers (status dot + name + handle + status text); "+ N more" if more than 5
   - "View all influencers in this set →" CTA → navigates to BrandCampaignInfluencersList with `setIdFilter: s.id`
5. If `sets.length === 0` → empty card with [DOT] tile + "No sets created yet" + sub-copy
6. If campaign load fails → "Campaign not found" + go-back CTA
7. Pull-to-refresh → re-fires `getCampaign`

## Success definition

The workflow is SUCCESSFUL only if:
- Both screens render with locked palette (ink topbar, yellow accents, type-coloured chips)
- All 9 user-observable steps on Path A and 7 on Path B complete without crash
- Behavior preserved 1:1: refetch on focus (SetsList), pull-to-refresh both, "View all" nav to BrandCampaignInfluencersList carries setIdFilter, back nav works
- No regression in the 24 Wave-3 follower/restaurant screens (no tokens.js change in this flow)
- No regression in the 75 brand-web/admin-web tests in `pnpm qa`

## Failure / edge workflows

- **StorePreview backend slow** → ActivityIndicator persists; user can swipe back and re-enter (preserved)
- **StorePreview brand has no city / category** → row renders gracefully with `'—'` fallback (preserved)
- **SetsList with mix of handpick + open_group sets** → each card renders its appropriate funnel/no-funnel; mini-roster filters per OPEN_GROUP_HIDDEN set for open_group (preserved)
- **Set with no `window_start/end` and no budget** → meta row hidden cleanly (no orphan separators; preserved)
- **Influencer in roster with unknown status** → status dot falls back to `P.muted3` (preserved)
