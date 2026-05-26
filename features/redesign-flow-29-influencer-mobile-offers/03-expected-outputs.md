# Flow 29 — Expected outputs

## Visual evidence (matches locked mockup)

### Frame 1 — OfferList Active tab
- Ink topbar with 30×3 yellow rule + "Offers" title (Outfit-Bold 22, white) + sub line mono uppercase muted-white ("3 active · 2 expiring soon" or similar dynamic).
- Tab pills horizontal scroll: "Active (3)" ink-active with yellow text · 4 others bg2 with muted text + count after first load.
- 3 offer cards: brand name (Outfit 14.5) + campaign sub (mono 10.5 muted) + canonical StatusPill (Invited / Negotiating / Applied).
- Per-card stats: Fee (mono digits) + Deliverable + Expires countdown (danger-text when <6h).
- "Tap to view details ›" dashed-underline hint on invited cards.

### Frame 2 — OfferList Declined tab
- Tab pills "Declined (5)" ink-active.
- 3 cards demonstrating canonical pills for `declined` / `rejected_by_brand` / `slots_filled`.
- "Reason: Fee Too Low" row when `declined_reason` present.
- Muted date in stat row.

### Frame 3 — OfferList Empty (Accepted)
- Centered EmptyState with `check-circle-outline` MCI icon in 66×66 dashed-yellow tile.
- "No accepted offers yet" title + per-tab descriptive sub.

### Frame 4 — OfferDetail (Engagement, invited)
- Ink topbar with back-chevron MCI + brand initial yellow tile + brand name + meta (mono uppercase muted-white) + canonical Invited pill + chevron-right.
- Countdown timer chip: `[timer]` MCI + "EXPIRES IN 5h 22m 14s" yellow on ink-overlay.
- Campaign Info card with grid rows.
- Offer Details: successPale Fee Highlight "₹15,000" centered + Deliverables Required list.
- Payment Terms: 3 tranche rows with success/yellow/ink dots + percentages + descriptions + mono amounts. Total Fee row mono successText. Yellow-pale TDS note.
- Action card: ink "ACCEPT OFFER" primary (yellow text, Outfit-Black) + secondary row Negotiate (ghost-ink) + Decline (danger-pale).

### Frame 5 — OfferDetail (Conversion + Negotiate form)
- Same header pattern.
- Offer Details: successPale Commission Highlight "12%" + hint line.
- Mono coupon code in kv row.
- Payment Terms: commission-only paragraph (no tranches).
- Counter Offer card: ink-bordered commission % input + note placeholder + ink "SEND COUNTER OFFER" CTA.

## Data assertions (no change)

- `influencerApi.getOffers(statusFilter)` returns existing `{ offers: [...] }` shape — Flow 29 consumes `[].{id, status, brand_name, business_name, campaign_name, agreed_fee, influencer_budget, per_influencer_budget, set_budget, deliverable_type, offer_expires_at, contract_signed_at, created_at, declined_reason}` (fallback chains preserved).
- `influencerApi.getOfferDetail(id)` returns the full offer with 40+ fields including `brand_logo_url`, `brand_id`, `brand_category`, `brand_city`, `campaign_brief`, `goal`, `commission_pct`, `deliverables[]`, `formats_json`, `offer_config_json`, `offer_type`, `coupon_code`, `physical_delivery`, `delivery_address`, `negotiation`, `influencer_mode`, `max_cap`, `allow_commission_negotiation`, `allow_negotiation`, etc.
- `influencerApi.getCampaignProducts(id)` returns `{ products: [{id, name, product_name, price}, ...] }` — Flow 29 reads `name || product_name` + `price`.
- `acceptOffer(id)` → `{ success: true }` on success.
- `declineOffer(id, { reason })` → `{ success: true }`.
- `negotiateOffer(id, { proposed_fee, proposed_commission_pct, note })` → `{ success: true, data: { negotiation: { id } } }`.
- `submitNegotiationTurn(negId, { action: 'counter', ... })` → `{ success: true }`.

## Behavioural assertions (preserved)

- `pnpm qa` 76 passed gate 0 STATE=GREEN on first run after dual-probe pre-warm.
- Tap offer card on list → routes to OfferDetail with `offer` route-param.
- Tap Accept on invited → Alert.confirm → API call → Alert.success → goBack.
- Tap a decline reason → Alert.confirm → API call → "Declined" alert → goBack.
- Submit counter (no neg yet) → `negotiateOffer` → `navigation.replace('Negotiation', {negotiation_id})`.
- Submit counter (neg exists) → `submitNegotiationTurn` → same replace.
- Countdown ticks every 1s; switches to "Offer Expired" + danger-pale when remaining ≤ 0.
- Tap brand row (when `brand_id`) → `navigation.navigate('BrandProfile', {brand_id})`.
- Tap "View Contract" CTA → `navigation.navigate('Contract', {campaignInfluencerId: offer.id})`.
- Tap "Submit Content" CTA (gated on contracted/active + deliverables exist) → DeliverableList.
- Tap "Open Chat Thread" (in negotiation status card) → `navigation.navigate('Negotiation', {negotiation_id, campaign_influencer_id})`.

## Regression watch

- All 5 OfferList tabs filter correctly (status filter strings unchanged).
- All 25+ OfferDetail render branches function (goal × status × open-group × negotiation × physical-delivery combinations).
- Real-time countdown timer interval cleanup on unmount.
- Defensive JSON parse for `formats_json` + `offer_config_json` still handles string-or-object shape.
- Cross-tab notifications deep-link → OfferDetail still works (route shape preserved).
- StatusPill canonical map untouched — all 39 entries unchanged.
