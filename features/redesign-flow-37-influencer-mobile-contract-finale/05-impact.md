# Flow 37 — Impact

**Chat verdict (terse)**: zero functional / backend / logic / DB impact — visual + UX only.

## Files changed

| File | Change | LOC delta |
|---|---|---|
| `Packages/Mobile/src/screens/influencer/ContractScreen.js` | Direct rewrite via token swap + StatusPill canonical migration + font injection | 1,534 → ~1,550 |
| `Packages/Mobile/src/components/DateTimeChipPicker.js` | Restyle to brandPalette + Outfit/Mono fonts + ink-active chips | 185 → ~190 |
| `features/redesign-flow-37-*/` | 7 contract artifacts | new |
| `design/wave2/flow-37-*/` | text-spec mockup | new |

**Total source delta**: ~1,719 → ~1,740 LOC (≈+21).

## APIs touched

**ZERO** — all 10 APIs preserved verbatim.

## Backend changes

**ZERO**.

## Regression surface

- `pnpm qa`: zero mobile-touching tests; expect 76/76 GREEN.
- `pnpm qa:db`: unchanged.
- Maestro 4/4 baseline; founder physical smoke covers — especially the Sign Modal MIUI keyboard flow on Redmi 13C.

## Mobile-specific risks

- Sign Modal MIUI keyboard-flicker fix preserved (Modal renders OUTSIDE ScrollView + KeyboardAvoidingView)
- 2-party flip-to-remote state machine preserved
- 7 visit sub-states + 4 shipment sub-states preserved
- Goal-aware tranche vs commission card visibility preserved
- DateTimeChipPicker date/hour/minute selection state preserved
- 6 × Alert 2-confirm flows preserved (sign, complete, received, flip, etc.)
- StatusBadge → StatusPill migration touches contract status (1 use), deliverable status (1 use), production event status (1 inline pill) — 11 statuses total, all already in canonical map
- KeyboardAvoidingView Platform.OS guard preserved

## Deploy class

**Production-impacting** — mobile-only OTA.

- `ota:brand` v87 (shared bundle; no brand-screen changes)
- `ota:influencer` v76 (all Flow 37 redesigns)
- `ota:follower` v50 (shared bundle)

**Bucket close**: after Flow 37 ships, mobile-influencer bucket = **23/23 COMPLETE**. Next bucket = mobile-follower (44 screens).

Native rebuild: NOT required.

## Time estimate

~3h total.
