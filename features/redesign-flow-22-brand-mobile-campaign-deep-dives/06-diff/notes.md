# Flow 22 — before/after diff notes

## Files touched

- **Modified**: `Packages/Mobile/src/components/brand/StatusPill.js` — additive: 7 new entries in STATUS_MAP_DEFAULT (applied, negotiating, contracted, active, invited, rejected_by_brand, slots_filled). Existing 19 entries byte-identical.
- **Modified**: `Packages/Mobile/src/screens/brand/BrandCampaignInfluencersListScreen.js` — full rewrite consuming brandPalette + ScreenHeader + StatusPill + EmptyState + Outfit/PJS/Mono fonts. Inline `P` const + STATUS_CFG dropped.
- **Modified**: `Packages/Mobile/src/screens/brand/BrandCampaignReviewQueueScreen.js` — full rewrite consuming brandPalette + ScreenHeader + EmptyState + fonts. Inline `P` const dropped.
- **NOT touched**: theme/tokens.js, Conversions/InfluencerBrowse (Flow 21 consumers).

## Visual delta

### CampaignInfluencersList
- Inline ink topbar (20 LOC) → `<ScreenHeader title="Influencers" sub="← {campaign.name}" back onBack count countLabel="of N" />`
- Inline STATUS_CFG (15 LOC, 12 keys) → `<StatusPill status={ci.status} />` (canonical map handles all 12 + 7 new)
- Inline empty card → `<EmptyState icon="[NONE]" title sub />`
- All fonts: System → Outfit (headings) / PJS (body) / JetBrains Mono (digits, handles, labels)
- Search wrap focus border: ink-yellow border highlight
- Filter chips: bg2 inactive + ink/yellow-mono active
- Card structure preserved (top row with name/handle/set-chip + right column with StatusPill + fee/comm)
- Deliverable progress bar + tranche row (T1/T2/T3 with ✓/○/◐/—) preserved
- Action button hierarchy: Reject (bg2 + danger) + Approve (ink + yellow) + Cancel (white red border + danger text) + Open chat (yellow + ink) + Open contract (successPale + success)

### CampaignReviewQueue
- Inline ink topbar → `<ScreenHeader title="Review queue" sub back onBack />`
- Inline empty card → `<EmptyState icon="[✓]" title sub />`
- Tab bar: yellow underline + yellowPale count chip on active
- Hint banner: yellowPale bg + yellow left border + ink icon-circle (mono `!` glyph)
- URL strip: bg2 with yellow-hover text (preserved)
- All fonts upgraded to locked stack
- Action button hierarchy: Revise (bg2) + Approve (ink + yellow) + Confirm live (success + white)

## Behavior delta

**Zero behavioral change.**

| Behavior | Status |
|---|---|
| useFocusEffect refetch on both screens | Preserved |
| InfluencersList: 12-status canonical map via StatusPill | Now sourced from STATUS_MAP_DEFAULT (extended) — labels match exactly |
| InfluencersList: OPEN_GROUP_HIDDEN filter | Preserved verbatim |
| InfluencersList: CANCELLABLE set | Preserved verbatim |
| InfluencersList: actionLoading per-row + ActivityIndicator on busy | Preserved |
| InfluencersList: approveApplication slots_filled alert with closed_out_count | Preserved verbatim |
| InfluencersList: tranche marker (✓ released / ○ locked / ◐ queued / — none) | Preserved (now uses brandPalette.successText / ink / yellowHover / muted3) |
| InfluencersList: nav to BrandInfluencerProfile / BrandNegotiation / BrandContract | Preserved verbatim |
| ReviewQueue: 2-tab + initialTab param | Preserved |
| ReviewQueue: Alert.prompt feedback flow with Android fallback | Preserved verbatim |
| ReviewQueue: confirmLive Alert variants (t2_released vs partial with pending_count) | Preserved verbatim |
| ReviewQueue: hint banner on live tab when liveQueue.length > 0 | Preserved |
| Both: pull-to-refresh | Preserved |

## StatusPill extension

Additive 7 entries:
```js
applied:            { bg: yellowPale,  fg: yellowText,  label: 'APPLIED' }
negotiating:        { bg: yellowPale,  fg: yellowText,  label: 'NEGOTIATING' }
contracted:         { bg: successPale, fg: successText, label: 'CONTRACTED' }
active:             { bg: successPale, fg: successText, label: 'ACTIVE' }
invited:            { bg: bg2,         fg: muted2,      label: 'INVITED' }
rejected_by_brand:  { bg: dangerPale,  fg: dangerText,  label: 'REJECTED' }
slots_filled:       { bg: bg2,         fg: muted2,      label: 'SLOTS FILLED' }
```

**Verify-twice**: Flow 21 consumer (Conversions) uses statuses `completed`, `pending`, `cancelled`, `refunded` — all 4 are byte-identical pre/post extension. Zero regression.

## Wave-3 follower regression check

theme/tokens.js unchanged. 24 Wave-3 follower screens see byte-identical exports.

## QA classification

Expecting GREEN. If MSG91 throttle / Render cold-start recurs from Flows 19/21 → ship `deployed-pending-certification` per precedent. Flow 22 touched only Packages/Mobile/** + 1 additive component change — zero causal path to brand-web or API failures.

## What's NOT in this flow

- Retroactive Flows 18-20 migration to consume new components (deferred polish pass)
- Bulk operations
- Filter by goal
- Deliverable preview / media player (out of scope; future Flow 25 territory for MediaGallery)
- New StatusPill API (mode-based override, etc. — `mode='transaction'` from Flow 21 still works unchanged)
