# Flow 34 — Before/After diff notes

## Before (legacy palette/fonts)

| Screen | Visual |
|---|---|
| EarningsScreen | Navy hero · white amount + rgba-white mini stats · navy ActivityIndicator · navyPale goal badges · teal+orange progress bars · navy method-active card · 📱/🏦 method emoji · border2 amount input · navyPale TDS card · orange Withdraw CTA · 📄 TDS-cert emoji · ad-hoc StatusBadge on history rows |
| CommissionDetailScreen | Navy hero · '#7DEFA0' Earned + '#FFD080' Pending stat values · navyPale info tiles · teal+orange tranche dots + lines · tealPale released tranche bg · ad-hoc trancheStatusBadge with teal/orange · teal+orange commission left borders · teal/orange dots · teal/orange amount colors · navyPale 30-day info card with navy text |
| TransactionFeedScreen | White-bg topbar · surface2 back-btn · surface2 summary cards with teal/orange/info amount colors · type-emoji-prefixed pills with teal/purple+15 backgrounds · tealDeep commission amount · 📋 booking-ref emoji · 📊 empty emoji |

## After (brandPalette + Outfit/PJS/Mono + StatusPill canonical)

| Screen | Visual |
|---|---|
| EarningsScreen | Ink hero with yellow rule + uppercase mono "AVAILABLE TO WITHDRAW" + yellow-mono ₹ amount + white-mono mini stats · yellow ActivityIndicator · purple-conv goal badges (conversion) + yellowPale (engagement/hybrid) · success+yellow progress bars (matches Flow 32/33) · ink-active method card + bg2-inactive + **MCI cellphone/bank icons** (replaces 📱/🏦 per design call #2) · ink-bordered amount input with Outfit-Black ₹ + mono number · yellowPale TDS preview with danger TDS line + successText You-Receive · ink/yellow Outfit-Black UPPERCASE WITHDRAW NOW CTA · yellowPale MCI file-document tile for TDS certificate (replaces 📄) · StatusPill canonical on history rows |
| CommissionDetailScreen | Ink hero with BACK + Outfit-Black + mono brand + 3-stat hero card with successGreen Earned / warn-orange Pending / white Total · 3-tile info row (Goal/Status/Fee mono UPPERCASE) · Tranche Timeline with unified success-fill dots + check-bold MCI + ink-bordered yellow current step number (matches Flow 32/33) + success-light tranche-card bg for released · StatusPill canonical (Released/Locked) · success/yellow commission summary card left borders · success/yellow commission row dots · successText amount color (confirmed) · UPPERCASE mono "22D TO CONFIRM" warn / "CONFIRMED" success · infoPale 30-day-window info banner with Outfit-Black title |
| TransactionFeedScreen | White-bg topbar with bg2 MCI back-btn + Outfit-Bold title · 3-summary card row (success/warn/info) with bg2 cards + mono numbers + UPPERCASE mono labels · per-tx card with 4 type-pill variants (walkin=successPale · book=infoPale · order=convPale · click=yellowPale) — **emoji 🏪📅📦🔗 KEPT per design call #4 (type-icon class)** · Outfit-Bold name + mono brand·product + mono UPPERCASE campaign·date · successText commission + mono UPPERCASE sale · booking-ref mono UPPERCASE row (no 📋) · 📊 empty emoji preserved (decorative) |

## Per locked design call

| # | Decision | Implementation |
|---|---|---|
| 1 | Hero amount = yellow-mono | `hero.color = P.yellow` + JetBrains-Mono Black |
| 2 | Method selector = MCI vectors | MCI `cellphone-outline` + `bank-outline`, no emoji |
| 3 | Tranche timeline = unified success/yellow + ink-bordered current | Success fill + check-bold MCI completed + yellow + ink-border current step number |
| 4 | TX type emojis KEPT | TYPE_LABELS unchanged (🏪📅📦🔗) — type-icon class, consistent with CATEGORY_EMOJI / DELIVERABLE_ICONS |

## Render-branch preservation evidence

| Screen | Branches preserved verbatim |
|---|---|
| EarningsScreen | Loading / empty campaigns / has-campaigns / amount entered → TDS preview / amount < 100 disabled / withdrawing → "Processing…" / has-withdrawals history / no-withdrawals (history hidden) |
| CommissionDetailScreen | Loading / error+retry / goal-aware commission section / commissions > 5 show-more / pending → 30-day info banner / tranche released vs locked / commission confirmed vs pending |
| TransactionFeedScreen | Loading / summary present / summary null (hidden) / empty / FlatList / booking_ref present / 4 transaction_type variants |

**Total preserved**: 16+ render branches across 3 files.

## API preservation evidence

All 7 APIs invoked with identical request shapes:
```js
influencerApi.getEarnings()
influencerApi.getCampaignEarnings()
influencerApi.getWithdrawals()
influencerApi.withdraw({ amount_requested, method })
influencerApi.getTdsCertificateUrl()  // url builder
influencerApi.getCampaignCommissionDetail(campaignInfluencerId)
influencerApi.getMyTransactions(1)
```

## Sign-off

- Mockup locked 2026-05-27 (founder · 4 design calls all match mockup defaults)
- Implementation locked 2026-05-27 (founder · "pls continue flow34")
- Web QA: see lock.json
- OTA versions: see lock.json
