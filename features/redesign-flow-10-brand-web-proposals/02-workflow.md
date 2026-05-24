# 02 · Workflow — Flow 10

## End-to-end happy paths (preserved verbatim)

### Page load
1. Brand visits `/dashboard/proposals`
2. Two parallel fetches: `proposalApi.list(tab || null)` + `proposalApi.getSettings()`
3. Proposals list renders (rows ordered by `created_at DESC`, max 100)
4. Settings cached in state for the inline panel + warning banner
5. Empty state if `proposals.length === 0`

### Tab switch
1. Brand clicks a status tab (All / New / Viewed / Countered / Accepted / Rejected)
2. State updates → useEffect re-runs `load()` with the new status query param
3. List re-fetched server-side; tab counts derived client-side from the loaded array

### Open settings
1. Brand clicks "Settings" button → inline `SettingsCard` renders below header
2. Toggle `accepts_proposals` · pick min tier · pick allowed niches · pick city/past-collab flags · set min ER
3. "Save settings" → `proposalApi.updateSettings({ accepts_proposals, proposal_filters })`
4. On success → panel closes + `load()` refreshes the list

### Open proposal (mark viewed)
1. Brand clicks a row → opens `ProposalDetailModal`
2. Modal shows stats + pitch + proposed terms + portfolio links
3. Server-side: when modal opens by calling `proposalApi.get(id)`, the backend `getBrandProposal` marks status `sent → viewed` automatically and returns the updated proposal
4. (NOTE: current OLD page does NOT call `proposalApi.get(id)` on row click — it just uses the loaded `proposals[]` row. The "mark viewed" side-effect therefore doesn't fire today on row-click in the OLD page. The NEW page preserves this OLD behaviour — no `get(id)` call on row click — so we don't change view-mark semantics.)

### Accept proposal
1. Brand clicks "Accept" in modal → `window.confirm(...)`
2. On confirm → `proposalApi.accept(proposal.id)` → server creates draft contract (`campaign_influencer` row) via `acceptedFlow(proposal, false)` + notifies influencer via FCM/push
3. On success → modal closes + list refreshes

### Reject proposal
1. Brand clicks "Decline" → reject mode opens with optional message textarea
2. "Confirm reject" → `proposalApi.reject(proposal.id, message || null)`
3. On success → modal closes + list refreshes

### Counter proposal
1. Brand clicks "Counter" → counter mode opens with fee + commission + message inputs (pre-filled with proposed values)
2. "Send counter" → `proposalApi.counter(proposal.id, { proposed_fee, proposed_commission_pct }, message)`
3. On success → modal closes + list refreshes; proposal status flips to `countered` on backend

## Error states (preserved)

- `proposalApi.list` fails → empty list, no error UI (matches OLD behavior)
- `proposalApi.getSettings` fails → settings stays null, warning banner won't show
- Modal action fails → `alert(res.error.message)` toast (matches OLD)

## NO-TOUCH preserved

- All 8 endpoints + every request body shape
- Settings JSON shape: `{ accepts_proposals: bool, proposal_filters: { min_tier, allowed_niches[], city_match_required, min_engagement_rate, only_past_collabs } }`
- Modal action gating: only `sent` + `viewed` statuses can be accepted/rejected/countered
- Tab keys: ['', 'sent', 'viewed', 'countered', 'accepted', 'rejected']
- Brand-approval gate inherited from `layout.js`
- View-mark semantics (unchanged — OLD page doesn't call `get(id)` on row click, NEW page won't either)
