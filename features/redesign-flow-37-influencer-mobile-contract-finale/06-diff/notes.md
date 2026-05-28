# Flow 37 — Before/After diff notes

## Before (legacy palette/fonts)

navyDeep header · ad-hoc StatusBadge · teal/orange/navy tranche dots · navy CTAs (Sign Contract / View PDF / Send slot / Accept / etc.) · tealPale active banner · tealPale fee highlight · #FFF8E0+gold clause highlight box · navyPale production panel · teal-bordered slot card · orange-tinted flip banner · gold-cream draft banner · DateTimeChipPicker navy-active chips + tealPale summary.

## After (brandPalette + Outfit/PJS/Mono + StatusPill canonical)

ink header with yellow rule + Outfit-Black title + StatusPill canonical (replaces ad-hoc StatusBadge for contract status + deliverable status + production event status) · success/yellow/ink tranche dots (matches Flow 31/34 pattern) · ink/yellow Outfit-Black UPPERCASE primary CTAs throughout · success-bg active banner · successPale fee highlight w/ successText value · yellowPale clause highlight box w/ yellow border · bg2 production panel · success-bordered slot card · yellowPale flip banner · yellowPale draft banner · DateTimeChipPicker ink-active chips w/ yellow text + successPale summary.

## Per locked design call

| # | Decision | Implementation |
|---|---|---|
| 1 | Header = ink + yellow rule | `header.backgroundColor = P.ink` + 30px yellow rule at bottom |
| 2 | Tranche dots = success/yellow/ink | T1=success, T2=yellow, T3=ink (matches Flow 31/34) |
| 3 | Production mode emojis 💻🏬📦 KEPT | Type-icon class consistent with CATEGORY_EMOJI/DELIVERABLE_ICONS |
| 4 | StatusPill canonical replaces ad-hoc | Contract (6) + deliverable (5) + production event (5) statuses — all in 43-entry map |

## Render-branch preservation evidence

~40 branches preserved verbatim across:
- 6 contract statuses · 3 production modes · 5 production event statuses
- 7 visit sub-states · 4 shipment sub-states
- Goal-aware (tranches vs commission card)
- Sign Modal MIUI keyboard fix
- 2-party flip-to-remote flow
- DateTimeChipPicker state
- 6 Alert 2-confirm flows
- Custom clauses highlight conditional
- Deliverables live vs formats_json fallback
- reschedule_count_influencer 2/2 cap warning
- Log history strip

## API preservation evidence

All 10 APIs invoked with identical request shapes:
```js
influencerApi.getContract(campaignInfluencerId)
influencerApi.signContract(contractId, { typed_name })
influencerApi.getProduction(contractId)
influencerApi.getProductionDateRange(contractId)
influencerApi.acceptProduction(eventId)
influencerApi.proposeProductionSlot(eventId, { visit_scheduled_at, visit_window_minutes, notes })
influencerApi.counterProposeProduction(eventId, { visit_scheduled_at?, visit_window_minutes?, shipment_to_address_line?, notes? })
influencerApi.flipProductionToRemote(eventId)
influencerApi.confirmProductionReceived(eventId, {})
influencerApi.completeProduction(eventId, {})
```

## Sign-off

- Mockup locked 2026-05-28 (founder · "Audit + ship now (extends current run)" — standing autonomy on 4 design calls inheriting from Flow 28-36 patterns)
- Implementation locked 2026-05-28
- Web QA + OTA: see lock.json
- **Bucket COMPLETE (23/23) after this flow.**
