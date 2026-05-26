# Flow 31 — 06-diff/notes.md

## Before

**MyCampaignsScreen (268 LOC)** on wave-1 palette:
- Dark navy header + white text.
- Navy active tab + surface2 inactive.
- StatusBadge (legacy) on each card.
- `colors.navy` ActivityIndicator, `colors.t1/t3` text, `colors.border`.

**CampaignDetailScreen (1,176 LOC)**:
- Dark navy header + StatusBadge.
- Teal-based progress indicator (active dots + lines).
- Teal Accept buttons + navyPale secondary buttons.
- Teal-pale fee highlight + tealDeep text.
- Teal/orange/navy tranche dot color logic.
- GoldPale TDS note + #7A5500 text.
- OrangePale negotiation info box + orangeDeep text.
- GoldPale publish-products CTA + #7A5500 text.
- TealPale completion banner.
- NavyPale preparing/secondary boxes.
- Surface2 quick action tiles + emoji-like text icons ([C]/[N]/[$]/[%]).
- Inline hex literals (#FFF8E0, #E8D590, #7A5500, etc.).
- 4 StatusBadge usages in JSX (header + campaign_status + deliverable rows + tranche rows).

## After

**StatusPill +4 canonical entries**:
- `published` → infoPale / info / 'PUBLISHED' (campaign_status)
- `revision_requested` → yellowPale / yellowText / 'REVISION' (deliverable_status)
- `locked` → bg2 / muted2 / 'LOCKED' (tranche_status)
- `released` → successPale / successText / 'RELEASED' (tranche_status)
- Map total: 39 → 43 entries.

**MyCampaignsScreen restyled**:
- Ink topbar + 30×3 yellow rule + back-chevron MCI + "My Campaigns" Outfit-Bold 22 + mono sub line.
- Tab pills: ink-active (yellow text + mono-bold) / bg2 inactive (muted + mono-bold).
- Per-card: Outfit brand name + mono campaign name + canonical `<StatusPill>` + 3 mono stats + footer date range.
- Pull-to-refresh tintColor = P.ink.
- Drops `import StatusBadge` + all colors.* references.

**CampaignDetailScreen restyled**:
- Ink topbar + 30×3 yellow rule + back-chevron MCI + brand name + campaign name + canonical `<StatusPill>`.
- **Completion banner** (successPale + check-bold MCI in success-bg circle).
- **Publish-products CTA** (yellowPale + 1.5px yellow border + ink Outfit title + mono sub + ink chevron-right MCI).
- **Quick Actions grid**: bg2 tiles with ink-bg/yellow-icon MCI tiles (file-document-outline / handshake-outline / storefront-outline / currency-inr / tag-outline / percent-outline) + Outfit labels + mono badges for counts.
- **5-step Progress Indicator**: yellow-active dots + yellow-active lines + ink-bordered larger current step.
- **Campaign Info**: 3 grid rows + new `published` canonical pill for campaign_status.
- **Requirements & Deliverables**: brief box + posting date + content requirements + deliverables table with MCI badges + canonical pills (incl. new `revision_requested`) + brand feedback + 3 conditional action CTAs (Upload Content, Submit Live URL, pre-contract hint).
- **Brand Info** card: 2 grid rows.
- **Payment** card:
  - Fee highlight (engagement/hybrid): successPale + Outfit-Black mono digits + base+bonus breakdown in successText.
  - Commission highlight (conversion/hybrid): same successPale tone.
  - Pure-conversion payment note.
  - Tranche progression: success/yellow/ink dots based on status + canonical pills (`released` / `locked`).
  - Expected 25/25/50 schedule when no tranches yet.
  - yellowPale TDS note.
- **Contract Status** (`renderContractSection`) — 8 semantic-tone sub-banners:
  - `invited`: terminal text "will be generated after accept"
  - `negotiating`: convPale negotiation info box + handshake MCI + ink/yellow "View Negotiation" CTA
  - `accepted/+null contract`: infoPale "preparing..."
  - `accepted/+draft`: yellowPale "Brand reviewing draft" + ghost-ink View Contract Details
  - `accepted/+pending_influencer`: successPale "Your turn to sign" + ink/yellow Review & Sign CTA + ghost-ink View Details
  - `accepted/+pending_brand`: infoPale "Waiting for brand counter-signature" + ghost-ink View Details
  - `accepted/+active`: successPale "Contract active" + ghost-ink View Details + ink/yellow View PDF
  - `declined/expired`: bg2 terminal message
- Each post-accept variant: signature timeline (Your + Brand signed_at dates).
- Drops `import StatusBadge` + all colors.* references.

## What matches the mockup
- All 3 phone frames + side panel variants.
- Yellow-active progress dots + ink-bordered current.
- bg2 quick-action tiles + ink/yellow MCI icon tiles.
- Semantic-tone contract banners (4 variants).
- yellowPale+yellow-border publish CTA.
- success→yellow→ink tranche progression.

## What honestly diverged
- Mockup shows 2 quick-action tiles in Frame 2 (Contract + Earnings) but real screen renders up to 6 conditional tiles. Implementation uses the same flex-wrap pattern that adapts to count.
- Completion banner check-circle in mockup → implementation uses the `check-bold` MCI for slightly heavier visual weight.

## Preserved verbatim
- All 3 `influencerApi.*` endpoint calls + payload shapes.
- All 22+ render branches (3 in MyCampaigns + ~22 in CampaignDetail incl. 8 contract sub-states).
- 5-step progress indicator with `getStepIndex(status)` helper.
- Goal-aware logic (`showFee` / `showCommission` / `showTranches`).
- Fee fallback chain: `contract?.influencer_fee || campaign.agreed_fee || influencer_budget || per_influencer_budget || 0`.
- Bonus math: totalFee = base + bonus.
- Tranche math: `Math.round(fee × pct / 100)` for expected schedule.
- products_pending: `Math.max(0, productsTotal - productsPublished)`.
- Render-error try/catch wrap on main render.
- Console.log debug lines.
- All Alert.alert flows.
- `STATUS_STEPS`, `DELIVERABLE_LABELS`, `DELIVERABLE_ICONS` constants.
- useFocusEffect reload on MyCampaigns.
- All `navigation.navigate(...)` targets.
