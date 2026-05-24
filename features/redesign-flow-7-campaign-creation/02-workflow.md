# 02 · Workflow — Flow 7

## End-to-end happy path (preserved verbatim from today's wizard)

1. Brand visits `/dashboard/campaigns/new`
2. `brandApi.getMe()` resolves → approval check
   - If `status !== 'approved'` → "Account Under Review" screen
   - Else continue
3. `brandApi.getProducts()` loads catalogue for later offer pickers
4. If `?editId=<draft-id>` in URL → `campaignApi.get(editId)` rehydrates draft into state, jumps to Step 2
5. **Step 1**: brand fills name + dates + total_budget + allow_negotiation. Validation runs live. "Build sets →" triggers:
   - `campaignApi.create({ name, start_date, end_date, total_budget, allow_negotiation })` first time OR
   - `campaignApi.update(cid, ...)` if already created (e.g. after Save draft)
   - On success → setStep(1)
6. **Step 2**: brand expands a set accordion, fills sections
   - Selecting goal unlocks the conditional sections (set_budget hidden for conversion, coupon_prefix shown for conversion/hybrid, etc.)
   - "Add influencers" opens browse drawer → `influencerApi.search(params)` paginated. Selecting + clicking "Add N · Invite M":
     - For onboarded creators → added to `set.influencers` array locally
     - For unclaimed/scraped creators → `creatorInvitationApi.create(...)` per row + added to local array
   - "Configure offer" on a row opens offer drawer; the 5 offer-type sub-shapes are mutually exclusive
   - "Open group" mode swaps in the group params form; "Preview matches" calls `campaignApi.getOpenGroupMatches(cid, si, params)` for a live count
   - Per-set save fires on "Review →":
     - `campaignApi.createSet(cid, setPayload)` if no backendId
     - `campaignApi.updateSet(cid, setBackendId, setPayload)` else
     - Per influencer: `campaignApi.inviteInfluencer / updateInfluencer`
   - "Save draft" runs the same API path without advancing step
7. **Step 3**: review screen renders summary. "🚀 Publish campaign" triggers `campaignApi.publish(cid)` which:
   - Server-side validates wallet ≥ total escrow lock needed
   - Server-side locks T1 escrow per influencer
   - Server-side flips campaign status: draft → pending_wallet → published
   - Server-side fires invite notifications to all assigned influencers
   - On success → toast + redirect to `/dashboard/campaigns/${id}` (hub)

## Error states (preserved verbatim)

- Wallet short at publish → server returns `WALLET_INSUFFICIENT` with required vs available
- Validation failures keep user on current step with per-field red borders + summary line
- Network errors show inline `err-msg` (now restyled to locked palette danger tone)
- Budget overspent → publish button disabled + amber/red strip
- Scraped-creator invite race (admin already invited them) → silently dedup'd server-side, no UI change

## Resume / edit path

- `?editId=X` reloads draft into wizard state, jumps user to Step 2 to continue
- Save draft on any step persists current state, stays on step

## Auth + role

Inherited from layout.js unchanged — brand role required, approved status required.
