# Workflow Definition — Flow 22

## Actor
Logged-in brand on mobile app, deep-linked from CampaignDetail with `{ campaignId, statusFilter? }`.

## Preconditions
- A published campaign with 0+ sets and 0+ influencers across sets
- 0+ deliverables in submitted/under_review or approved-with-live-url state

## Workflow steps

### Path A — CampaignInfluencersList
1. Reach via `navigate('BrandCampaignInfluencersList', { campaignId, statusFilter? })`. ScreenHeader: back-pill "← {campaign.name}" + "Influencers" title + crumb + count "N of M".
2. `useFocusEffect` reloads getCampaign on focus.
3. Search wrap input + clear-X. Set filter chip strip (with counts) if multiple sets. Status filter chip strip (with counts) ordered: all / applied / invited / negotiating / accepted / contracted / active / live / completed / declined / rejected_by_brand / expired / slots_filled.
4. Per-card render: name + handle + (optional) set chip + StatusPill via canonical map + fee/commission lines (goal-aware) + deliverable progress bar (yellow fill on bg2 track, mono digits) + tranche row (T1/T2/T3 with ✓/○/◐/— marks colored by state) + transaction count for conversion/hybrid + action buttons.
5. Action buttons (status-conditional):
   - applied → Reject (bg2/danger text) + Approve (ink/yellow text)
   - invited/accepted/negotiating → Cancel (red border + red text)
   - negotiating → "Open chat" (yellow/ink) → nav to BrandNegotiation
   - accepted/contracted/active → "Open contract" (successPale/successText) → nav to BrandContract
6. Loading → ScreenHeader preserved + centered yellow ActivityIndicator. Campaign-not-found → error state.

### Path B — CampaignReviewQueue
1. Reach via `navigate('BrandCampaignReviewQueue', { campaignId, initialTab? })`. ScreenHeader: back-pill + "Review queue" + crumb.
2. Tab bar: To review (yellow underline when active) | Confirm live, each with mono count chip on yellowPale when active / bg2 when not.
3. Live-tab hint: yellow-pale left-bordered card explaining tranche-2 release dependency.
4. Per-card render: type label + influencer handle/name + (optional) set name italic + (review-tab) submitted date + URL strip (content_url for review, live_url for confirm) + action button(s):
   - reviews tab: Revise (bg2) + Approve (ink/yellow)
   - live tab: Confirm live (success/white)
5. Action handlers:
   - Revise → Alert.prompt for feedback → reviewDeliverable(id, request_revision, feedback)
   - Approve → reviewDeliverable(id, approve)
   - Confirm live → Alert.alert confirmation → confirmLive(id) → optional success/partial Alert
6. Empty (per-tab) → success-toned EmptyState "You're all caught up".

## Success
- Both screens render with brandPalette + new components + Outfit/PJS/Mono fonts
- All action handlers resolve to identical backend state transitions
- Tranche dots + deliverable progress bar continue to reflect server state accurately
- Cross-screen nav (Negotiation, Contract, InfluencerProfile) preserved
- pnpm qa green (no overlap)

## Failure / edge
- InfluencersList: empty open_group statuses hidden via OPEN_GROUP_HIDDEN filter; cancellable set CANCELLABLE = {invited, accepted, negotiating}
- ReviewQueue: Alert.prompt unavailable on Android → fallback to default revision message
- Both: pull-to-refresh re-fires getCampaign
