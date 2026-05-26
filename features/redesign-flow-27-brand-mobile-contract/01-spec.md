# Flow 27 — Brand-mobile Contract redesign (spec)

## Problem

`Packages/Mobile/src/screens/brand/BrandContractScreen.js` (1341 LOC, biggest mobile-brand screen) is the only Wave-1 surface left after Flows 18-26. It currently uses the old `colors.*` palette (`navy`, `navyDeep`, `tealPale`, `t1/t2/t3`, etc.) with ad-hoc hex literals (`#FFF8E0`, `#7A5500`, `#E0FAF5`, `#5C50C8`, `#FDEEE9`), inline RGBA status pills, and emoji icons in the production-mode picker. Visually inconsistent with the brandPalette-driven bucket; closing it ships the mobile-brand bucket COMPLETE.

## Goal

Restyle the entire screen to the locked brandPalette + Outfit/PJS/JetBrainsMono font stack + canonical `<StatusPill>` component + mono-bracket production-mode icons, **without touching a single API shape, business-rule branch, or state-machine transition**. After ship: mobile-brand bucket finale → next bucket = mobile influencer (23 screens) per `feedback_redesign_app_sequence`.

## Scope (in)

- `Packages/Mobile/src/screens/brand/BrandContractScreen.js` — full rewrite of `StyleSheet` + JSX color/font references + mode-picker icons. All logic byte-equivalent.
- `Packages/Mobile/src/components/brand/StatusPill.js` — extend `STATUS_MAP_DEFAULT` by 3 entries: `proposed`, `confirmed`, `in_progress`. Map total 34 → 37.

## Scope (out)

- **No backend / API / migration / DB change.** Zero touch.
- **`brandApi.*`** — all 11 endpoint signatures + all payload field names preserved verbatim.
- **`STANDARD_CLAUSES` constant** — 3 clause definitions preserved verbatim (data, not styling).
- **`DateTimeChipPicker`** — shared with `influencer/ContractScreen.js`; restyle deferred to influencer bucket.
- **`ContractPdf` screen** — separate file, separate flow.
- **`BrandProductionPanel`** — kept INLINE in this file. Not extracted (handoff §16.4: extract only on 2+ reuse).
- **Wallet lock math** — `(base + bonus) × (1 + platformFeePct / 100)`. Duplicated in 2 places; both kept literal (don't DRY).
- **`isReApprove` derivation** — `pending_influencer && !contract.influencer_signed_at`. Preserve verbatim.
- **Defensive `custom_clauses` parse** — try/catch IIFE for JSON-string vs object shape. Preserve verbatim.
- **`keyboardShouldPersistTaps="always"`** — Android keyboard quirk fix. Preserve.

## Data (preserved verbatim)

11 `brandApi` endpoints:
- `getContract(campaignInfluencerId)` · `getMe()`
- `approveContract(contract.id, { custom_clauses, bonus_amount, content_requirements, production_mode })`
- `brandSign(contract.id)`
- `getProduction(contractId)` · `getProductionDateRange(contractId)` · `setProductionVisitDetails(contractId, {...})`
- `acceptProduction(event.id)` · `counterProposeProduction(event.id, {...})` · `flipProductionToRemote(event.id)`
- `dispatchProduction(event.id, { courier, awb })` · `completeProduction(event.id, {})`
- `initialiseProduction(contractId, mode)`

## Visual decisions (locked 2026-05-26 chat)

1. **Header status pill labels**: canonical — `DRAFT` / `YOUR TURN` / `AWAITING INFLUENCER` / `ACTIVE`. Consistent with every other bucket screen.
2. **Production-mode picker icons**: mono-bracket — `[VISIT]` / `[SHIP]` / `[REMOTE]`. Matches EmptyState convention; deterministic across OEMs.
3. **Header treatment**: bespoke ink topbar with 30×3 yellow rule (not `ScreenHeader` — right-slot is a status pill, not a count chip; aligns with Profile/Wallet/MediaGallery precedent).
4. **StatusPill extension**: +3 canonical entries for production-event statuses (proposed/confirmed/in_progress).
5. **DateTimeChipPicker restyle**: deferred to influencer bucket (shared component).

## Acceptance

- All 17 render branches visually upgraded to brandPalette without any branch logic touched.
- All 4 main-screen contract states render with canonical StatusPill labels.
- All 5 production-event states render canonical StatusPill (including 3 new entries).
- Mode picker renders `[VISIT]` / `[SHIP]` / `[REMOTE]` mono-bracket icons.
- Wallet shortage UI matches mockup (danger border + breakdown + disabled button + "Top up wallet to send" label).
- `pnpm qa` 76+ passed gate 0 STATE=GREEN first run (after dual-probe pre-warm).
- Mobile-brand bucket = COMPLETE.
