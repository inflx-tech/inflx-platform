# Feature Spec — Flow 23 · brand-mobile ActionRequired + Negotiation

## Problem / goal

Sixth flow of the mobile-brand bucket. Two highest-interaction screens:
- **BrandActionRequiredScreen** (494 LOC) — global inbox with 5 tabs (Applications / Negotiations / Reviews / Signatures / Failures). Each tab lazy-loads its own list. Signatures tab supports bulk-sign with selection checkboxes + total wallet lock calc. Failures tab supports per-row retry. Applications tab supports per-row approve/reject. Imports an external `components/StatusBadge` (Flow 23 replaces with canonical `<StatusPill>`).
- **BrandNegotiationScreen** (439 LOC) — chat-style turn thread between brand + influencer with goal-aware action panel (engagement = fee counter; conversion = commission counter; hybrid = both). Accept / Counter / Walk-Away primary actions. Original → Latest summary card. Auto-scrolls to bottom on new turn.

Both currently navy + orange legacy. Migrate to brandPalette + Flow 21 components + fonts. Behavior preserved 1:1.

## Scope

**In scope:**
- Visual rewrite of both screen files consuming brandPalette + ScreenHeader + StatusPill + EmptyState + Outfit/PJS/JetBrains-Mono
- Replace `components/StatusBadge` import in ActionRequired with `components/brand/StatusPill` (existing StatusBadge file untouched)
- Extend `StatusPill.STATUS_MAP_DEFAULT` with negotiation-specific statuses: `awaiting_brand` (yellowPale "YOUR TURN"), `awaiting_influencer` (infoPale "WAITING"), `agreed` (successPale "AGREED"), `walked_away` (bg2 "CLOSED"), `open` (yellowPale "OPEN"). Additive only.
- Preserve all behavior: lazy tab loading, bulk-sign with totalLock calc + Alert confirmation, per-row appBusy/retrying tracking, useFocusEffect refetch, goal-aware action panel rendering, scroll-to-end on new turn, Accept/Counter/Walkaway Alert flows, isMyTurn detection, isOpen/isClosed state machines

**Explicitly out of scope:**
- theme/tokens.js changes
- Touching `components/StatusBadge.js` (deferred polish pass; influencer/follower may still use it)
- API / backend changes
- Adding bulk actions to other tabs

## Surfaces touched
- mobile-brand: 2 screen files + 1 component file (additive map extension)

## Data / contracts
- **APIs**: getInboxSummary, listInboxApplications, listInboxNegotiations, listInboxDeliverables, listPendingContracts, listInboxFailures, bulkSignContracts, retryContractCreate, regenerateContractPdf, approveApplication, rejectApplication; getNegotiation, getNegotiationByCampaignInfluencer, submitNegotiationTurn — all unchanged
- **Money**: influencer_fee, bonus_amount, platform_fee_pct, last_proposed_fee, proposed_fee, current_fee, original_fee, proposed_commission_pct, current_commission_pct — all preserved (rupees + percent)
- **lockAmount calc**: `(base + bonus) * (1 + platformFee/100)` preserved verbatim

## Non-functional
- Auth/role gates: unchanged
- Failure modes: ActionRequired tabs render empty-state with tab-specific icon + msg; Negotiation not-found shows error card; submitNegotiationTurn errors → Alert; bulkSignContracts errors → Alert with count
