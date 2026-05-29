# Flow 49 — Before / After diff notes

## What shipped
The 2 fashion screens converted from Wave-3 **dark** to light `brandPalette`.
**Visual + UX only — zero functional change.** First flow of F5.

| Screen | Before | After |
|---|---|---|
| ProductDetailScreen (465) | `colors` navy StyleSheet + `getBusinessAccent` (dark) on hero/badge/CTA/prices | brandPalette + `getBusinessAccentLight`; fashion-pale hero/`more` tints; **ink/yellow CTA**, ink-mono price, successText savings, ink/yellow discount badge, ink creator-note bar (yellow attr + yellowPale quote) |
| LookbookDetailScreen (189) | `darkColors` + `#142438`/`#0D1D2E` + hardcoded pink `#ec4899` | brandPalette + FASHION_PALE cover/image tints; white creator card (yellow avatar + ink initial), ink-mono price, yellowPale creator-note (yellow left-border) |

## Design correction (founder-approved)
Per-business accent (fashion pink) relocated from CTAs/prices → hero/image **tints
only** (F0 rule). CTAs ink+yellow, money ink-mono, savings successText. Approved via
AskUserQuestion ("Green — implement", incl. the accent correction).

## Matches the mockup
`design/wave3/flow-49-follower-fashion/web.html` (founder green-signaled 2026-05-28).
2 frames implemented as drawn.

## Verification
- **Babel transform:** both PASS (Mobile metro preset).
- **Orphaned-token grep:** ProductDetail 0 `colors.`/`accentDim`/`getBusinessAccent`/
  `darkColors`/`fmtMoney`; LookbookDetail 0 `darkColors`/dark-hex/`#ec4899` (only the
  intentional rgba-white floating-back remains).
- **Marker grep:** availing_modes / dispatchCta / getStoreProducts / getLookbook /
  tracking / nav present (25 occ) — logic untouched.

## After-evidence
Emulator after-screenshots SKIPPED (deep, data-gated detail screens). After-evidence =
mockup + founder physical APK smoke-test on live follower v62.

## Preserved verbatim
availing_modes CTA dispatch + category verb maps · dispatchCta nav + 4-ID tracking ·
discount math + price computation · getStoreProducts/getLookbook · More-from-brand
replace-nav · lookbook creator-tracking nav · CATEGORY_EMOJI.
