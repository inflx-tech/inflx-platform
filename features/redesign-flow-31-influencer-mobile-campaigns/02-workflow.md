# Flow 31 — Workflow

## Actor
Authenticated influencer on mobile (post-Flow-28 APK, NATIVE_RUNTIME=2).

## Preconditions
- Influencer authenticated (JWT in AsyncStorage).
- For MyCampaigns: entry from Tab navigator (`Campaigns` tab).
- For CampaignDetail: entry by `campaignInfluencerId` route param from MyCampaigns card tap, OfferDetail next-step, or notifications deep-link.

## Steps

### A. MyCampaignsScreen

1. Mount → `getMyCampaigns(tab)` with tab in {active, completed, all}.
2. Tabs: ink-active pill / bg2 inactive — taps reload + show loading.
3. useFocusEffect → reload when returning from CampaignDetail (so newly-completed campaigns surface).
4. Render branches:
   - Loading → centered ActivityIndicator
   - Error → empty-state card with retry button
   - Empty → empty icon + tab-specific copy
   - List → per-card render with status pill + 3 stats (Fee / Goal / Deliverables count) + date range
5. Card tap:
   - If `influencer_status === 'completed'` → navigate to CampaignCompletion
   - Else → navigate to CampaignDetail
6. Pull-to-refresh reloads current tab.

### B. CampaignDetailScreen

1. Mount → `getMyCampaignDetail(campaignInfluencerId)`.
2. If status='negotiating' → lazy-load `getNegotiationByCampaignInfluencer(ciId)` for the negotiation info box.
3. Loading state with full-screen spinner.
4. Error / not-found state with retry + go-back buttons.
5. Main render (wrapped in render-error try/catch):
   - **Header**: ink topbar + 30×3 yellow rule + back chevron + brand_name + campaign_name + canonical `<StatusPill>` for influencer_status.
   - **Completion banner** (status='completed') → successPale tappable card → CampaignCompletion.
   - **Publish-products CTA** (showCommission && contract.status='active' && products_pending > 0) → yellowPale+yellow-border banner → CampaignProducts.
   - **Quick Actions card**: 2-6 conditional bg2 tiles (Contract / Negotiation / Publish to Store / Earnings / Coupon / Commission rate display) with ink/yellow MCI icon-tiles.
   - **Campaign Progress** card: 5-step indicator (invited → accepted → contracted → active → completed) with yellow-active dots + lines, ink-bordered current step.
   - **Campaign Info** card: 3 grid rows (Campaign + Campaign Status pill / Start + End / Type).
   - **Requirements & Deliverables** (`renderRequirementsSection`):
     - Brief box (if campaign.brief)
     - Posting Date row (if campaign.posting_date)
     - Content Requirements (if contract.content_requirements)
     - Deliverables table with MCI badge per type + quantity + deadline + revisions + canonical pill (incl. new `revision_requested` pill)
     - Brand Feedback (if any deliverable has brand_feedback)
     - Upload Content CTA (active/contracted + pending/revision_requested deliverables exist)
     - Submit Live URL CTA (approved deliverable + no live_url)
     - Pre-contract hint (if not active)
   - **Brand Info** card: 2 grid rows.
   - **Payment** card:
     - Fee highlight (engagement/hybrid) = successPale + bonus breakdown if bonus > 0
     - Commission highlight (conversion/hybrid)
     - Pure-conversion payment note
     - Tranche progress: real tranches with success/yellow/ink dots + canonical pills (released / locked); OR expected 25/25/50 schedule when no tranches
     - TDS note (yellowPale, only when showTranches)
   - **Contract Status** card (`renderContractSection`): 8 sub-states with semantic-tone banners:
     - invited → "Contract will be generated after you accept"
     - negotiating → convPale negotiation info box + ink/yellow "View Negotiation"
     - accepted/contracted/active/completed + contract.status null → infoPale "Contract is being created"
     - accepted/contracted/active/completed + contract.status='draft' → yellowPale "Brand reviewing draft"
     - accepted/contracted/active/completed + contract.status='pending_influencer' → successPale "Your turn to sign" + ink/yellow "Review & Sign Contract" CTA
     - accepted/contracted/active/completed + contract.status='pending_brand' → infoPale "Waiting for brand counter-signature"
     - accepted/contracted/active/completed + contract.status='active' → successPale "Contract active"
     - declined/expired → bg2 terminal message
   - Each post-accept variant shows signature timeline + ghost-ink "View Contract Details" + (if fully active) ink/yellow "View Contract PDF".

## Success
- All canonical pills render with new entries (`published` for campaign_status; `revision_requested` for deliverables; `locked`/`released` for tranches).
- 5-step progress indicator updates per influencer_status.
- 8-state contract section renders correctly with the right semantic-tone banner.
- Quick Actions tiles render only the ones relevant to current state.
- pnpm qa stays green.

## Edge cases (preserved verbatim)
- Render-error try/catch wrap fires on any sub-component crash → renders "Something went wrong" with retry + go-back.
- Empty deliverables / no contract / no tranches all handled by conditional rendering.
- Fee fallback chain handles null/undefined gracefully.
- products_total = 0 hides the publish-CTA banner.
- Console.log debug lines retained for founder debugging.

## What does NOT change
- Any backend route/controller/migration.
- Any influencerApi signature or payload.
- 5-step progress state machine.
- 8-state renderContractSection branching.
- Goal-aware logic.
- Fee fallback chain.
- products_pending math.
- useFocusEffect for tab reload.
