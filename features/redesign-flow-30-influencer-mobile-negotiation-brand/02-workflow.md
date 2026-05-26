# Flow 30 — Workflow

## Actor
Authenticated influencer on mobile (post-Flow-28 APK, NATIVE_RUNTIME=2).

## Preconditions
- Influencer authenticated (JWT in AsyncStorage).
- For NegotiationScreen: a negotiation thread already exists (entry from OfferDetail's "Negotiate" CTA OR from NotificationsScreen's `negotiation_update` deep-link).
- For BrandProfileScreen: a brand_id passed via route.params (entry from OfferDetail's brand row tap).

## Steps

### A. NegotiationScreen

1. Mount → resolves negotiation by either `negotiation_id` OR `campaign_influencer_id` from route.params:
   - `negotiation_id` → `getNegotiation(id)`
   - `campaign_influencer_id` → `getNegotiationByCampaignInfluencer(ciId)`
2. Loading state during fetch.
3. Empty state if no negotiation found (with Go Back button).
4. Post-load render:
   - **Header** (ink with yellow rule): back chevron + "Negotiation" title + `<StatusPill mode="influencer" status={negotiation.status} />` + brand name (mono small caps) + campaign name (PJS).
   - **Offer Progress card**: Original → Latest side-by-side with chevron-right MCI; "current" box uses successPale; turn-info banner below (yellowPale=your-turn, infoPale=waiting, bg2=closed).
   - **Conversation card**: list of `turns[]` rendered as L/R bubbles. L (brand) = bg2 + muted-actor; R (influencer) = yellowPale + ink-actor. Each bubble: "Counter Offer" action badge + mono fee line + italic note (when present).
   - **Waiting banner** (when status='awaiting_brand'): infoPale card with hourglass MCI + "Waiting for Brand" + sub copy.
   - **Counter Offer form** (when status='awaiting_influencer'): ink/yellow "Accept ₹X + Y% comm." button + counter section (fee input + commission input, goal-aware) + note input + ink/yellow "Send Counter Offer" + dangerPale "Walk Away".
   - **Closed card** (status ∈ {agreed, walked_away}): successPale for agreed (with final terms summary), bg2 for walked_away.
5. Action paths:
   - **Accept current**: Alert.alert confirm → `submitNegotiationTurn(id, {action: 'accept'})` → on success Alert "Accepted" → goBack.
   - **Send Counter**: validate (fee > 0; commission 0-100) → `submitNegotiationTurn(id, {action: 'counter', proposed_fee, proposed_commission_pct, note})` → on success clear form + reload.
   - **Walk Away**: Alert.alert destructive confirm → `submitNegotiationTurn(id, {action: 'walkaway'})` → on success Alert "Closed" → goBack.
6. Pull-to-refresh reloads negotiation + turns.

### B. BrandProfileScreen

1. Mount → `getBrandPublicProfile(brand_id)` from route.params.
2. Loading state (full-screen ActivityIndicator).
3. Error / brand-not-found (with Go Back button).
4. Post-load render:
   - **Header** (ink with yellow rule): back chevron + 68×68 logo (image OR ink-Outfit-Black initial on yellow tile) + business_name (Outfit-Bold 22 white) + category badge (rgba-white-15).
   - **Brand Details card**: 4 conditional info rows (Business Name, Category, Location from address_line, On INFLX Since from created_at).
   - **Campaigns stat box**: yellowPale tile with mono `active_campaigns_count` number + ink mono small label.

## Success
- Negotiation status pill renders correctly per influencer POV (awaiting_brand=WAITING, awaiting_influencer=YOUR TURN).
- Turn bubbles render with correct L/R alignment + brand/influencer color.
- Accept/Counter/Walk actions function with their respective Alert flows.
- BrandProfile renders cleanly with initial fallback when no logo_url.
- Visual = locked mockup.

## Edge cases (preserved verbatim)
- Negotiation entry by `campaign_influencer_id` when no neg exists → NOT_FOUND → empty-state render (not Alert).
- `turn.sent_by` may be 'influencer' OR 'brand' → L/R routing.
- `negotiation.current_fee` may be null (commission-only) → renderProposalLine returns "—" or commission-only string.
- `goal === 'conversion'` → only commission input shown; no fee.
- `goal === 'engagement'` → only fee input shown; no commission.
- `goal === 'hybrid'` → both shown.
- Counter button disabled-state has 3 conditions (loading, fee-empty when showFee, commission-empty when showCommission && !showFee).

## What does NOT change
- Any backend route/controller/migration.
- Any influencerApi signature or payload.
- Any render branch boolean derivation (isInfluencerTurn, isAwaitingBrand, isOpen, isClosed).
- statusLabel() helper for friendly inline turn-info text.
- L/R turn bubble convention (sent_by === 'influencer' → right).
- Two-entry-point negotiation resolution.
