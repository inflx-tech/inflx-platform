# Flow 30 — Influencer-mobile Negotiation + BrandProfile (spec)

## Problem

`screens/influencer/NegotiationScreen.js` (622 LOC) + `BrandProfileScreen.js` (200 LOC) are wave-1 surfaces still on `colors.*` palette + bespoke navy/teal/orange accents that no longer match the brandPalette + MCI-icon convention established by Flow 28-29. NegotiationScreen also carries a dead `import StatusBadge` (line 15, never used in JSX).

Additionally, the canonical StatusPill (built from brand-mobile POV in Flow 23) renders `awaiting_brand → 'YOUR TURN'` and `awaiting_influencer → 'WAITING'` — which is BACKWARDS for influencer-side consumers. The remaining 22 mobile-influencer screens that consume these statuses need the labels flipped to make sense from the influencer POV.

## Goal

1. Restyle both files to brandPalette + fonts.* + canonical `<StatusPill>` with role-correct labels.
2. Extend `<StatusPill>` with a new `mode='influencer'` prop (mirrors the existing `mode='transaction'` pattern from Flow 21) that flips:
   - `awaiting_brand → 'WAITING'` (waiting for brand to respond)
   - `awaiting_influencer → 'YOUR TURN'` (your turn to respond)
   All other status keys are unaffected.
3. Drop dead `import StatusBadge` from NegotiationScreen.

## Scope (in)

- `Packages/Mobile/src/components/brand/StatusPill.js` — add `mode='influencer'` branch (~3 lines).
- `Packages/Mobile/src/screens/influencer/NegotiationScreen.js` — full restyle. Header `<StatusPill mode="influencer" />`. Turn bubbles brandPalette. Counter form ink/yellow CTA. Walk Away dangerPale. Drop unused StatusBadge import. Keep `statusLabel()` helper for friendly inline turn-info text.
- `Packages/Mobile/src/screens/influencer/BrandProfileScreen.js` — full restyle. Ink topbar + yellow rule. 68×68 yellow logo tile (initial fallback in ink Outfit-Black). Brand Details 4-row info card. yellowPale active-campaigns stat box with ink mono number.

## Scope (out)

- **No backend / API / migration / DB change.** Zero touch.
- **All 4 influencerApi calls preserved verbatim** (getNegotiation, getNegotiationByCampaignInfluencer, submitNegotiationTurn, getBrandPublicProfile).
- **All 13 NegotiationScreen render branches preserved** (loading, empty, header, offer-progress, turns-empty, turn-bubbles, action-badge, waiting-banner, counter-form, accept-button, walkaway-button, closed-agreed, closed-walked).
- **All 6 BrandProfileScreen render branches preserved** (loading, error+empty, header+initial-fallback, info-card-4-rows, stat-box).
- **Goal-aware logic** (`showFee`/`showCommission` from `negotiation.goal`) preserved verbatim.
- **L/R turn-bubble convention** preserved: brand=left (bg2) · influencer=right (yellowPale) based on `turn.sent_by === 'influencer'`.
- **`submitNegotiationTurn` payload shape** preserved (action='counter'|'accept'|'walkaway', proposed_fee, proposed_commission_pct, note).
- **All Alert.alert confirmation flows** preserved (accept, walkaway).
- **Counter validation rules** preserved (fee > 0; commission 0-100).

## Data — preserved verbatim

4 endpoints:
- `influencerApi.getNegotiation(id)` → `/negotiations/:id`
- `influencerApi.getNegotiationByCampaignInfluencer(ciId)` → `/negotiations/by-ci/:ciId`
- `influencerApi.submitNegotiationTurn(id, {action, proposed_fee, proposed_commission_pct, note})` → `/negotiations/:id/respond`
- `influencerApi.getBrandPublicProfile(brand_id)` → `/brands/:id/public`

Fields consumed (zero phantom):
- `negotiation.{id, status, goal, brand_name, campaign_name, current_turn, original_fee, original_commission_pct, current_fee, current_commission_pct}`
- `turns[].{id, created_at, sent_by, proposed_fee, proposed_commission_pct, note}`
- `brand.{business_name, logo_url, category, address_line, created_at, active_campaigns_count}`

## Visual decisions (locked 2026-05-26 chat)

1. **StatusPill role-perspective**: add `mode='influencer'` to flip `awaiting_brand`/`awaiting_influencer` labels — clean canonical extension mirroring Flow 21's `mode='transaction'`.
2. **Offer Progress card**: keep side-by-side Original→Latest with chevron-right MCI arrow; original=bg2 + ink, current=successPale + successText.
3. **Turn bubbles**: brand=left (bg2 + muted actor label), influencer=right (yellowPale + ink actor label).
4. **Action buttons**: Accept=ink/yellow + Counter=ink/yellow + Walk=dangerPale/dangerText. Both primary CTAs feel "forward"; Walk is the destructive exit.

## Acceptance

- All 13 + 6 render branches visually upgraded to brandPalette + fonts.*.
- StatusPill canonical map total: 39 (unchanged); `mode='influencer'` branch added.
- `pnpm qa` 76+ passed gate 0 STATE=GREEN first-run after dual-probe pre-warm.
- After ship: 22 → 21 remaining influencer screens.
