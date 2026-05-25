# Flow 17 · workflow — happy paths preserved

## W1 · Brand lands on /dashboard/campaigns/[id]/escrow
1. URL mounts with `id` from useParams
2. `useEffect` fires `brandApi.getCampaignEscrow(id)`
3. Determine view state:
   - If error → render error card
   - If `campaign.has_tranches === false` → conversion-only notice
   - If `!entries || entries.length === 0` → empty card
   - Else → 4-KPI hero + per-influencer breakdown
4. Loading state shown while fetching

## W2 · Brand views tranche details
- Each per-influencer card shows handle + tranches
- Status icon + Outfit Tranche N + mono meta (trigger_event + released_at when present)
- Mono amount + palette status pill

## W3 · Brand clicks "Open Conversions tab" (conversion-only)
- Link navigates to `/dashboard/campaigns/{id}?tab=conversions`

## W4 · Brand clicks "Campaign" breadcrumb
- Navigates back to `/dashboard/campaigns/{id}`

## Mutation-preservation
- None — page is read-only
- No backend release/lock mutations exposed in this page

## Field mapping (frozen)
- summary.{total, total_locked, total_released, total_queued} → hero KPIs
- influencer_breakdown[].{instagram_handle, influencer_name, tranches[]} → per-inf cards
- tranches[i].{id, tranche_number, trigger_event, status, amount, released_at} → tranche rows
- campaign.{name, has_tranches} → header + state selection
- entries[] → empty-state check (length only)
