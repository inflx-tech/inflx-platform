# Workflow Prediction — Flow 22

## InfluencersList — tile → source

| Tile | Source |
|---|---|
| Header back + name | `campaign.name` |
| Header count "N of M" | `filtered.length` / `allInfluencers.length` (client-side derive) |
| Search input filter | client-side `(influencer_name OR instagram_handle).includes(q)` |
| Set filter chips with counts | `campaign.sets[*].id`, counts derived per-set (open_group filter applied) |
| Status filter chips with counts | derived from `allInfluencers.status` distribution |
| Card name + handle | `ci.influencer_name`, `ci.instagram_handle` |
| Card set chip | `ci.set_name` (joined from set on flatten) |
| StatusPill | `ci.status` → canonical map (extended in Flow 22) |
| Fee | `ci.agreed_fee` (rupees) shown when goal in (engagement, hybrid) |
| Commission | `ci.commission_pct` shown when goal in (conversion, hybrid) |
| Deliverable progress | `ci.deliverable_counts` { total, live, approved, submitted, under_review, revision_requested } — completed = live + approved |
| Tranche row | `ci.tranche_statuses` { t1, t2, t3 } each can be released/locked/queued/null → marker ✓/○/◐/— |
| Transaction count | `ci.transaction_count` for conversion/hybrid |
| Action: Approve | `brandApi.approveApplication(campaignId, ci.id)` → response includes optional `{ slots_filled, closed_out_count }` |
| Action: Reject | `brandApi.rejectApplication(campaignId, ci.id)` |
| Action: Cancel | `brandApi.cancelInfluencer(campaignId, ci.id)` |
| Action: Open chat | `navigation.navigate('BrandNegotiation', { negotiationId, campaignInfluencerId, influencerName, influencerHandle })` |
| Action: Open contract | `navigation.navigate('BrandContract', { campaignInfluencerId, influencerName, goal })` |

## ReviewQueue — tile → source

| Tile | Source |
|---|---|
| Header back + name | `campaign.name` |
| Tab counts | `reviewQueue.length` / `liveQueue.length` (flattened from sets[*].influencers[*].deliverables[*]) |
| Review queue inclusion | `d.status in (submitted, under_review)` |
| Live queue inclusion | `d.status === 'approved' && d.live_url` |
| Card type | `DELIVERABLE_LABELS[d.type]` (reel/post/story/youtube_video/youtube_short) |
| Card influencer | `d.influencer_name`, `d.instagram_handle` (enriched on flatten) |
| Card set | `d.set_name` (enriched on flatten) |
| Card date | `d.submitted_at` (formatDate IN) |
| URL strip | `d.content_url` (review tab) or `d.live_url` (live tab) |
| Action: Revise | `Alert.prompt` for feedback → `brandApi.reviewDeliverable(d.id, { action: 'request_revision', feedback })` |
| Action: Approve | `brandApi.reviewDeliverable(d.id, { action: 'approve' })` |
| Action: Confirm live | `Alert.alert` confirmation → `brandApi.confirmLive(d.id)` → response includes `{ t2_released, t2_amount, live_count, total_count, pending_count }` |

## Behavior preservation
| Behavior | Status |
|---|---|
| useFocusEffect refetch (both screens) | Preserved |
| pull-to-refresh (both) | Preserved |
| InfluencersList: open_group hidden filter | Preserved |
| InfluencersList: CANCELLABLE set | Preserved verbatim |
| InfluencersList: action loading per-row | Preserved verbatim |
| InfluencersList: empty state varies by whether filters are active | Preserved (slightly nicer copy) |
| ReviewQueue: 2-tab switcher with initialTab param | Preserved |
| ReviewQueue: Alert.prompt fallback for Android | Preserved verbatim |
| ReviewQueue: confirmLive Alert variants (full release / partial) | Preserved verbatim |
| ReviewQueue: hint banner on live tab when liveQueue.length > 0 | Preserved |

## What's NOT in this flow
- Bulk operations
- Filter by set goal
- New action types
- Deliverable preview (would need media player — Flow 25 territory)
