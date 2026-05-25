# Workflow Definition — Flow 20 · modal/form bundle

## Actor
Logged-in brand on mobile app.

## Preconditions
- BrandEnquiriesScreen: at least 0+ enquiries via influencer store pages
- BrandProposalInboxScreen: at least 0+ proposals received from influencers (brand may or may not accept proposals — `accepts_proposals` toggle in brand_settings)
- BrandInfluencerProfileScreen: a valid influencer id passed via `route.params.influencerId` (from BrandInfluencerBrowse or CampaignInfluencersList nav)

## Workflow steps (user-observable)

### Path A — Enquiries
1. Brand opens screen → ink topbar with title + subtitle. Filter chips strip below (All / New / Contacted / Converted / Closed). Default filter = All.
2. List renders; each card shows follower_name + status pill + phone + "via @influencer" + relative date + (if converted) deal value mono.
3. Tap card → bottom-sheet modal with full details + form_data_json rendered as label-value rows.
4. Status-dependent actions in modal:
   - If status NOT in (converted, closed): show "Mark as Contacted" secondary, "Mark as Converted" form (deal_value rupee input), "Close without converting" danger
   - If status === contacted: hide "Mark as Contacted" button
5. Mark as Contacted → `updateEnquiry(id, { status: 'contacted' })` → Alert + close modal + optimistic flip
6. Mark as Converted → require positive `deal_value` → `updateEnquiry(id, { status: 'converted', deal_value })` → Alert about influencer commission credited → close + flip
7. Close → confirmation Alert → `updateEnquiry(id, { status: 'closed' })` → close + flip
8. Filter tap → re-fires `getEnquiries({ status: filter })`; "New" key maps to "submitted" backend value

### Path B — Proposals
1. Brand opens screen → ink header (back arrow + "Proposals" title centred). Banner if `accepts_proposals: false` → "Turn on" CTA. Strip if true → "✓ Accepting · Pause".
2. Status tabs (All / New / Viewed / Countered / Accepted / Rejected) horizontal scroll. Tab tap re-fires `listProposals(tab)`.
3. List renders; each card shows pitch_title + influencer_name + handle + tier + status pill + pitch_message + fee/commission/date footer.
4. Tap card → bottom-sheet modal with 3-stats row + pitch + proposed terms rows + portfolio links + (if rejected) brand-response shown.
5. If status in (sent, viewed) → 3 action buttons: Decline | Counter | Accept
6. Accept → confirmation Alert ("draft contract will be created") → `acceptProposal(id)` → close + reload
7. Decline → `mode = 'reject'`; show textarea + Cancel + "Confirm reject" → `rejectProposal(id, msg)` → close + reload
8. Counter → `mode = 'counter'`; show fee input + commission% input + note textarea + "Send counter" → `counterProposal(id, { proposed_fee, proposed_commission_pct }, note)` → close + reload

### Path C — InfluencerProfile
1. Brand reaches screen via `BrandInfluencerBrowse → InfluencerProfile { influencerId }` or `CampaignInfluencersList → ...`.
2. `getInfluencer(id)` fires on mount; loading → centered yellow ActivityIndicator.
3. Ink hero with back arrow + 80px yellow avatar (initials in ink) + Outfit handle + full_name + tier·city·state meta. Then 6-tile stats grid (Followers, ER%, Avg Views, Posts, Avg Likes, Avg Cmts) with mono digits.
4. Sections: About (bio), Niches & Languages (yellowPale niche chips + engPale lang chips), Typical Pricing (range), Past Brands (top 5).
5. Sticky footer: yellow "Invite to Campaign" CTA → opens InviteModal.
6. **InviteModal step 1**: pick campaign (eligible = published / active / live). Tap row → step 2.
7. **InviteModal step 2**: pick set inside picked campaign. Tap row → step 3 + auto-prefill fee from `per_influencer_budget` and commission/offer for conversion/hybrid goals.
8. **InviteModal step 3**: confirm card (campaign + set + influencer) + goal-aware form (fee for engagement/hybrid; offer-type + value + commission% for conversion/hybrid; optional posting_date for all) + Send Invite button → `inviteInfluencer(campaignId, setId, payload)` → Alert + close + `navigation.goBack()`

## Success definition

All 3 screens render with brandPalette + canonical status-pill map. Every behavioural path above resolves to the same backend state changes as before. No regression in `pnpm qa` (75 tests). 24 Wave-3 follower screens untouched.

## Failure / edge

- Enquiries: empty state, status-filter empty, network failure on update → Alert, optimistic reverted on next load
- Proposals: not-accepting banner, no proposals in tab, reject/counter without filled fields → preserved current branching
- InfluencerProfile: not-found, modal step abandoned (back button on backdrop → onClose resets state), no eligible campaigns → empty panel
