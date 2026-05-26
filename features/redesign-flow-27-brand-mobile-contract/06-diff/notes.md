# Flow 27 — 06-diff/notes.md

## Before
- `BrandContractScreen.js` 1341 LOC on Wave-1 `colors.*` palette: navy headers, teal action highlights, t1/t2/t3 text hierarchy, ad-hoc hex literals (`#FFF8E0`, `#E8D590`, `#7A5500`, `#FFF4D6`, `#E0FAF5`, `#007A63`, `#EEEDFE`, `#5C50C8`, `#FDEEE9`), RGBA inline status pills in 2 places (header + production panel header), emoji icons in production-mode picker (🏬 📦 💻), system font default with `'monospace'` fallback for the requirements textarea.
- StatusPill canonical map at 34 entries (no production-event statuses).

## After
- Full brandPalette migration: ink topbar with 30×3 yellow rule, brandPalette tokens via `import { brandPalette as P, fonts } from '../../theme/tokens'`. Outfit display, Plus Jakarta Sans body, JetBrains Mono digits.
- Both inline status pills replaced with canonical `<StatusPill status={...} />` component.
- Production-mode picker icons swapped from emoji to mono-bracket `[VISIT]` / `[SHIP]` / `[REMOTE]` tiles (ink-on-yellowPale when active).
- StatusPill canonical map extended by 3 entries: `proposed` (yellowPale/yellowText), `confirmed` (successPale/successText), `in_progress` (infoPale/info). Total 34 → 37.
- All hex literals replaced with brandPalette family equivalents.
- All `colors.*` references replaced with `P.*` brandPalette references.

## What matches the mockup
- Topbar layout + 30×3 yellow rule.
- Card visual style (white surface, 1px border, 14px radius).
- Draft / waiting / active banners with appropriate brandPalette pale-tones.
- Wallet breakdown box (bg2 normal, dangerPale on shortage).
- Mode picker with mono-bracket icons.
- Signature box before/after states.
- Production panel: yellow-50 bg, slot card with success border, ink primary buttons, success alt buttons, white-outline secondary buttons.
- StatusPill canonical labels (DRAFT / YOUR TURN / AWAITING INFLUENCER / ACTIVE / PROPOSED / CONFIRMED / IN PROGRESS / COMPLETED / CANCELLED).

## What honestly diverged
- Production-mode icons: mockup shows mono-bracket as tile chips; implementation uses same pattern with brandPalette tokens (visually identical).
- Wallet breakdown: mockup uses CSS grid; implementation uses RN flex (functionally equivalent).
- DateTimeChipPicker: NOT restyled (deferred to influencer bucket because it's shared with `influencer/ContractScreen.js`). Still uses Wave-1 navy — will visually mismatch INSIDE the production panel's counter-proposal and reschedule flows. Founder accepted this divergence (chat 2026-05-26).

## Preserved verbatim (zero touch)
- All 11 `brandApi.*` endpoint calls + payload shapes.
- `STANDARD_CLAUSES` 3-entry constant (commercial_rights / category_exclusivity / content_ownership).
- All 17 render branches (4 contract states × wallet-shortage crosscut × 11 production sub-states + flip banner).
- `isReApprove` derivation: `isPendingInf && !contract.influencer_signed_at`.
- Defensive `custom_clauses` parse: try/catch IIFE for JSON-string vs object shape.
- Wallet lock math: `(baseFee + bonus) × (1 + platformFeePct / 100)` in 2 places, both literal.
- `keyboardShouldPersistTaps="always"` (Android keyboard fix).
- `BrandProductionPanel` kept INLINE in this file (not extracted).
- All Alert.* copy and confirmation flows.
- Navigation targets (`navigation.goBack()`, `navigation.navigate('ContractPdf', {...})`).
