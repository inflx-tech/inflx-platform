# Flow 29 — Influencer-mobile Offer list + Offer detail (spec)

## Problem

`Packages/Mobile/src/screens/influencer/OfferListScreen.js` (235 LOC) + `OfferDetailScreen.js` (1228 LOC, 3rd biggest screen in bucket) are the second surface in the mobile-influencer bucket. Both consume the legacy `colors.*` palette + emoji empty icons + legacy `StatusBadge` component + Wave-1 navy/teal accents that no longer match the brandPalette+MCI-icon convention established by Flow 28.

## Goal

Restyle both screens to brandPalette + `fonts.*` + canonical `<StatusPill>` + MCI icons + locked design choices, **without touching any backend route, API shape, business-rule branch, or state-machine transition**. Pure visual upgrade; ships via OTA only (Flow 28's native rebuild covered MCI font availability).

## Scope (in)

- `Packages/Mobile/src/screens/influencer/OfferListScreen.js` — full restyle:
  - 5 tab pills swapped to ink-active + bg2-inactive (locked design call #2)
  - 5 emoji empty icons → 5 MCI outline icons (locked design call #1): `inbox-outline` / `check-circle-outline` / `cancel` / `timer-sand` / `format-list-bulleted`
  - Empty state migrated to canonical EmptyState pattern (dashed-yellow tile)
  - Per-card status pill: `<StatusBadge>` → canonical `<StatusPill>`
  - Per-card expiry countdown in danger-text when < ~6h
  - brandPalette + fonts throughout
- `Packages/Mobile/src/screens/influencer/OfferDetailScreen.js` — full restyle:
  - Ink topbar with 30×3 yellow rule + back-chevron MCI icon
  - Brand row: yellow tile with ink initial fallback (no logo URL) OR brand_logo_url image; ink-bg meta + campaign sub line; canonical StatusPill on right
  - Countdown timer chip (yellow on ink) → danger-pale on Expired
  - Fee highlight + commission highlight → successPale/successText (locked design call #3)
  - 3-stage tranche dots: success / yellow / ink (locked design call #4)
  - TDS note: yellow-pale background + yellow-text
  - Action buttons: ink primary Accept (yellow text) + ghost-ink secondary Negotiate + danger-pale Decline
  - Negotiate form: ink-bordered fee/commission inputs with mono digits
  - Next-step CTAs (View Contract / Submit Content): yellow-pale bg with ink border
  - Drop `import StatusBadge` → canonical `<StatusPill>` throughout
  - brandPalette + fonts throughout

## Scope (out)

- **No backend / API / migration / DB change.** Zero touch.
- **All 7 `influencerApi.*` shapes preserved verbatim** (getOffers, getOfferDetail, getCampaignProducts, acceptOffer, declineOffer, negotiateOffer, submitNegotiationTurn).
- **All 40+ consumed offer fields preserved** (fee fallback chain, goal flags, formats_json/offer_config_json parses, deliverables array, etc.)
- **All 25+ render branches preserved verbatim** (goal-aware fee/commission/tranches, open-group vs handpick, 3 deliverable fallback states, 5 offer-type sub-renders, real-time countdown timer, negotiation form variants).
- **`useCountdown` hook** — interval + cleanup preserved.
- **`DECLINE_REASONS` constant** + 5-button modal preserved verbatim.
- **`DELIVERABLE_LABELS` constant** preserved verbatim.
- **`FORMAT_ALIAS` + `toCanonical` helpers** preserved verbatim (defensive deliverable-type normalization).
- **No StatusPill canonical map changes** (all 10 statuses already in 39-entry map).

## Data — preserved verbatim

7 endpoints already exist:
- `influencerApi.getOffers(status)` → `/offers/inbox`
- `influencerApi.getOfferDetail(id)` → `/offers/:id`
- `influencerApi.getCampaignProducts(id)` → `/influencers/me/campaigns/:id/products`
- `influencerApi.acceptOffer(id)` → `/offers/:id/accept`
- `influencerApi.declineOffer(id, {reason})` → `/offers/:id/decline`
- `influencerApi.negotiateOffer(id, {proposed_fee, proposed_commission_pct, note})` → `/offers/:id/negotiate`
- `influencerApi.submitNegotiationTurn(negId, {action, ...})` → `/negotiations/:id/respond`

## Visual decisions (locked 2026-05-26 chat)

1. **OfferList empty icons**: 5 MaterialCommunityIcons outline glyphs (`inbox-outline` / `check-circle-outline` / `cancel` / `timer-sand` / `format-list-bulleted`). Drop emoji.
2. **Tab pills**: ink active (yellow text) + bg2 inactive (muted text). Matches brand-mobile Flow 22.
3. **Fee/commission highlight cards**: `successPale` background + `successText` foreground. Cleanest brandPalette replacement for `tealPale`/`tealDeep`.
4. **Tranche dots**: 3-stage progression — T1 = `success`, T2 = `yellow`, T3 = `ink`. Reads as released → in-flight → final.

## Acceptance

- All 5 OfferList tabs render with new pill style + correct status filters.
- All 5 OfferList empty states render MCI icon + canonical pattern.
- All 25+ OfferDetail render branches visually upgraded without any branch logic touched.
- Real-time countdown timer renders correctly (1-second tick, switches to "Expired" when 0).
- Negotiate form input validation preserved (positive fee, 0-100 commission).
- Accept/Decline/Negotiate alerts preserved verbatim.
- Cross-tab nested navigation from notifications + bell deep-links → OfferDetail still works.
- `pnpm qa` 76+ passed gate 0 STATE=GREEN first-run after dual-probe pre-warm.
- Bucket progress: 2/23 mobile-influencer shipped.
