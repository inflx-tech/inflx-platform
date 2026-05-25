# Workflow Definition — Flow 23

## Actor
Logged-in brand on mobile app, reaches ActionRequired from BrandHome or deep-link push notification; Negotiation via tap-through from CampaignInfluencersList or ActionRequired's Negotiations tab.

## Preconditions
- ActionRequired: brand has at least 0+ items across one or more of: pending applications, awaiting-brand negotiations, submitted deliverables, pending-counter-sign contracts, contract/PDF failures
- Negotiation: a valid negotiationId or campaignInfluencerId in route params

## Workflow steps

### Path A — ActionRequired
1. Mount: ScreenHeader ink topbar + sub "Everything waiting on you" + back. Tab bar with 5 tabs (Apps/Negos/Content/Contracts/Failures); first tab autoload.
2. getInboxSummary supplies count chips per tab. Inactive tabs lazy-load on first activation.
3. Per-tab render branches (5 distinct):
   - Applications → per-row Approve (ink+yellow) + Reject (dangerPale+danger) buttons with appBusy spinner; View profile link.
   - Negotiations → tap card to nav BrandNegotiation. StatusPill = awaiting_brand (yellowPale).
   - Content → tap card to nav BrandCampaignDetail. StatusPill from item.status.
   - Contracts (signatures) → bulk-sign bar at top (yellow50 strip) with checkbox + totalLock + ink/yellow "Sign (N)" button + Alert confirmation; per-row checkbox + lock amount.
   - Failures → per-row retry button (Contract or PDF kind) with retrying spinner.
4. Empty per-tab: `<EmptyState icon=" [INBOX|CHAT|VIDEO|SIGN|OK]" title sub />`.
5. Pull-to-refresh fires getInboxSummary + the active tab's list endpoint.

### Path B — Negotiation
1. Mount: ScreenHeader ink topbar with title + 30×3 yellow rule + influencer name/handle sub + (optional) campaign sub2; right-side StatusPill from negotiation.status.
2. Summary card: Original→Latest boxes (bg2 + yellowPale current). Mono digits.
3. Turn thread: chat bubbles colour-coded brand=yellow50/yellowPale-border / influencer=white/border, alternating sides. Mono author label + counter-offer tag + mono fee + italic note + mono timestamp.
4. Action panel (when isOpen && isMyTurn): "Your turn" mono indicator + Accept (success green) + Walk Away (dangerPale + dangerText) + counter form (goal-aware fee/commission inputs) + note textarea + Send Counter (ink + yellow mono).
5. Waiting panel (yellowPale strip) when isOpen && !isMyTurn.
6. Closed panel (bg2 strip) when isClosed — different copy for agreed vs walked_away.
7. After submitting a turn (counter): auto-scroll-to-end via 300ms timeout. Alert + goBack on accept/walkaway success.

## Success definition
Both screens render with brandPalette + extracted components + Outfit/PJS/Mono fonts. All API calls and Alert flows resolve to identical backend state. Cross-screen nav from ActionRequired (Negotiation/CampaignDetail/Contract/InfluencerProfile) preserved with original param shapes.

## Failure / edge
- ActionRequired tab API errors → empty list (preserved current "no error toast" behaviour)
- bulkSignContracts failure → Alert with res.error.message; selection persists
- Negotiation: not-found state with go-back button (StatusPill omitted, header preserved)
- submitNegotiationTurn errors → Alert with message; counter form input persists
- Invalid Fee / Invalid Commission validation errors → Alert with field-specific copy (preserved)
