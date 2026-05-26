# Flow 29 — Workflow

## Actor
Authenticated influencer on mobile (RN, post-Flow-28 APK with NATIVE_RUNTIME=2 + MCI font bundled).

## Preconditions
- Influencer authenticated (JWT in AsyncStorage).
- Profile admin-verified (otherwise routed to "Profile recognised" gate, not Offers tab).
- Reaches OfferList via the Offers tab in InfluencerNavigator OR via notification deep-link `{ screen: 'Offers', params: { screen: 'OfferDetail', params: { offerId } } }`.

## Steps

### A. OfferList screen
1. Mount with `activeTab='active'` and `tabData={}` cache initialised for 5 tabs.
2. `loadTab('active')` fires → `influencerApi.getOffers('invited,negotiating,applied')` → populates `tabData.active.offers`.
3. Render branches:
   - Tab bar: 5 horizontally-scrolling pills. Active tab = ink bg + yellow text. Each pill shows count after first load (`Active (3)`).
   - Loading state per-tab (centered spinner + "Loading offers…").
   - Empty state per-tab: dashed-yellow tile with MCI icon (mapped per tab key) + tab-specific empty title + per-tab descriptive sub.
   - Offer cards: brand name + campaign name + StatusPill on right; mono Fee + Deliverable + per-tab third stat (Expires countdown for active in danger-text when <6h; Accepted date; Declined date + reason row; Expired date).
   - "Tap to view details ›" hint on invited cards.
4. Tab tap → `setActiveTab(key)` → if not loaded, `loadTab(key)` triggers via useEffect.
5. Pull-to-refresh → `loadTab(activeTab, true)`.
6. Card tap → `navigation.navigate('OfferDetail', { offer })`.

### B. OfferDetail screen
1. Mount with `passedOffer` from route params → `setOffer(passedOffer)` → `loadDetail()` fires.
2. `loadDetail` = `Promise.all([getOfferDetail(id), getCampaignProducts(id)])` → updates `offer` + `products`.
3. `useCountdown(offer?.offer_expires_at)` ticks every 1s while `expiresAt` is in the future.
4. Render branches by state + goal:
   - **Header**: ink topbar + back chevron + brand row (logo OR initial fallback / name / category-city meta / campaign / canonical StatusPill / chevron-right if brand_id).
   - **Countdown** (only when `isActionable = status==='invited'`): yellow chip on ink, danger-pale on Expired.
   - **Campaign Info card**: campaign / brand / category / location / start-end / type (goal) / brief.
   - **Offer Details card**:
     - Fee highlight (when `showFee = engagement||hybrid`): successPale tile with mono ₹ value.
     - Commission highlight (when `showCommission = conversion||hybrid`): successPale tile with `%` value + commission hint.
     - Deliverables (3 fallback states):
       - From `deliverables[]` table (post-sign): row per item with type label + quantity + deadline + status pill.
       - From `formats_json` parse (pre-sign): aggregate counts per canonical type via `FORMAT_ALIAS` + `toCanonical` helpers.
       - Fallback: single `deliverable_type` row.
     - Posting date / submission deadline (when present).
     - Coupon code (mono, when conversion/hybrid + has `coupon_code`).
   - **What You're Promoting card** (conversion/hybrid only): offer_type breakdown (5 sub-renders for discount/volume/bogo/bundle/free_gift) + product list (first 8, "+N more" pattern) + physical delivery info (yellowPale notice).
   - **Payment Terms**:
     - Tranche schedule (engagement/hybrid): 3 rows with success/yellow/ink dots, percentages, descriptions, mono amounts. Total row + yellowPale TDS note. Hybrid: additional commission note.
     - Commission-only note (conversion): plain paragraph explaining 30-day return window.
   - **Requirements card**: brief + revision limit + physical delivery guideline (with `*` bullets).
   - **Next Steps card** (status ∈ {accepted/contracted/active}): "Review & Sign Contract" → Contract screen + "Submit Content" (gated on `['contracted', 'active']` + deliverables exist) → DeliverableList screen.
   - **Open-group state cards**: applied (waiting) / wasRejected (not selected) / slotsFilled (campaign filled).
   - **Action buttons** (status='invited' + not Expired): primary Accept/Apply (ink+yellow) + secondary row Negotiate (white-on-ink ghost; only when not open-group + allow_negotiation) + Decline/Pass (danger-pale).
   - **Decline Reasons modal** (after Decline tap): 5 reason buttons → Alert confirm before `decline(reasonKey)`.
   - **Negotiate form** (after Negotiate tap OR when status='negotiating'): goal-aware fee + commission inputs (ink-bordered, mono) + note input + ink "Send Counter Offer" CTA. Validation: positive fee, 0-100 commission.
   - **Negotiation Status card** (when status='negotiating' + offer.negotiation exists): status pill + current-turn label + "Open Chat Thread" CTA → Negotiation screen.
5. Accept tap → Alert.confirm → `acceptOffer` → Alert.success → `navigation.goBack()`.
6. Decline reason tap → Alert.confirm → `declineOffer({reason})` → goBack.
7. Submit counter tap → validate → if `!negotiation` → `negotiateOffer` → `navigation.replace('Negotiation', ...)`; else `submitNegotiationTurn(negId, {action:'counter'})` → `navigation.replace('Negotiation', ...)`.

## Success
- Every branch renders correctly with brandPalette + MCI icons + canonical StatusPill.
- All 7 API call shapes + payload field names byte-equivalent to prior wave-1 behavior.
- All Alert flows + navigation transitions preserved.
- Real-time countdown ticks per second; cleanup on unmount.

## What does NOT change
- Backend routes, controllers, migrations, DB rows.
- Any `influencerApi.*` signature.
- `useCountdown`, `formatDate`, `formatDeclineReason` helpers.
- `DELIVERABLE_LABELS`, `DECLINE_REASONS`, `FORMAT_ALIAS`, `toCanonical` constants/helpers.
- Fee fallback chain, goal flags, validation rules.
- Defensive JSON parse for `formats_json` + `offer_config_json`.
- Tranche math (25/25/50).
- Navigation targets (Contract, DeliverableList, Negotiation, BrandProfile).
- Cross-tab nested routing payload shapes.
