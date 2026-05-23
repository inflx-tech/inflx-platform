# Workflow — Redesign Flow 4 · Brand mobile (Home + Campaign list)

> No new workflows. Visual + UX restyle + drop of 1 phantom field.
> All assertions describe behaviour that must remain unchanged.

## Actor
Authenticated brand on the brand mobile app (`APP_ROLE = 'brand'`).

## Preconditions
- Brand JWT in AsyncStorage
- Bottom-tab navigator mounted

## Workflow steps (user-observable, unchanged)

### BrandHomeScreen
1. Open Home tab → parallel fetch: `brandApi.getMe()`, `brandApi.getCampaigns()`, `brandApi.getInboxSummary().catch(...)`
2. Loading spinner during fetch
3. Status banner shows for pending/rejected/suspended brands → tap → navigate to BrandProfile
4. Wallet card shows balance + active count + total count
5. Top Up Wallet → `navigation.navigate('Wallet')`
6. Action Required card (when sum(inbox.*) > 0) → tap → `navigation.navigate('BrandActionRequired')`
7. Wallet alert (when ≥1 pending_wallet campaign) → tap → `navigation.navigate('Wallet')`
8. Open Web Dashboard → `openWebDashboard('/dashboard')` deeplink
9. 6 Quick Action tiles → each navigates to its target screen
10. Campaigns top-5 list → tap → `navigation.navigate('Campaigns', { screen: 'CampaignDetail', params: { campaignId } })`
11. See All → `navigation.navigate('Campaigns')`
12. Pull-to-refresh re-runs the load

### BrandCampaignListScreen
1. Mount → `brandApi.getCampaigns()` fetch
2. Search input filters by `c.name` (lowercase substring)
3. Filter chips set `filter` state (`'all'` + 4 statuses)
4. Sort chips set `sort` state
5. Card tap → `navigation.navigate('CampaignDetail', { campaignId })`
6. Checkbox tap → toggles in `selected` Set
7. Bulk Cancel (when ≥1 cancellable selected) → Alert confirm → bulk `brandApi.cancelCampaign(id)` calls
8. Bulk Delete (when ≥1 deletable selected) → Alert confirm → bulk `brandApi.deleteCampaign(id)` calls
9. Clear → empties selection
10. "Create on web" CTA at bottom → `openWebDashboard('/dashboard/campaigns')`
11. Pull-to-refresh re-runs the load

## Success definition

Every step above produces the same end state as today. `pnpm qa` 67/67 green (web specs unaffected). Phones load the new bundle on next launch (NATIVE_RUNTIME=1, no APK reinstall).

## Failure / edge workflows (unchanged from current)

- API failures → empty / loading-stuck states gracefully (current behaviour)
- Bulk partial-failure → Alert shows `N of M succeeded`
- No selection → bulk buttons disabled (visual + disabled state preserved)
- Search 0 matches → empty card with relevant copy
