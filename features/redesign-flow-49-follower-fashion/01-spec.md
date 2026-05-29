# Flow 49 — Follower FASHION vertical → light brandPalette (F5)

## Goal
Convert the 2 fashion screens — `ProductDetailScreen`, `LookbookDetailScreen` —
from Wave-3 **dark** (darkColors / legacy `colors` navy / hardcoded dark hexes +
hardcoded pink) to the F0-locked light `brandPalette`. **Visual + UX only. Zero
functional change.** First flow of Phase F5 (fashion + beauty + car).

## Screens in scope (2)
1. **ProductDetailScreen.js** (465) — single-product detail. Was `colors` (navy)
   StyleSheet + `getBusinessAccent` (dark accent map) applied inline. Hero, title,
   creator-note, price block, availing_modes CTAs, "More from brand", sticky footer.
2. **LookbookDetailScreen.js** (189) — creator-curated look grid. Was `darkColors`
   + hardcoded dark hexes (`#142438`/`#0D1D2E`) + hardcoded pink `#ec4899`. Cover,
   creator chip, 2-col product grid with creator notes.

## Design decision (founder-approved — corrects an F0 violation)
Both screens currently put the **per-business accent on the primary CTA + prices**.
The F0 rule is: per-business accent = **wayfinding tints only**; CTAs/money = ink+yellow.
So the redesign:
- fashion accent `getBusinessAccentLight('fashion')` = `#DB2777` / pale `#FCE7F3` →
  **hero + card image TINTS only**.
- primary CTA → **ink bg + yellow text**; discount badge → ink/yellow.
- prices → **ink mono**; savings → **successText**.
- creator notes → yellow creator-vibe (ProductDetail: ink note-bar + yellow
  attribution + yellowPale quote; Lookbook: yellowPale + yellow left-border).
- creator avatar → **yellow + ink** (CreatorChip DNA).

## Non-negotiable (preserve verbatim — see 05-impact.md)
`availing_modes` CTA dispatch (online_order→Buy / walkin_pay→Pay / prebook→Book /
enquiry→Enquire) + category-aware verb maps · `dispatchCta` nav with 4-ID tracking ·
discount math (percentage/flat/bogo/bundle/volume/gift) + price computation ·
`getStoreProducts` / `getLookbook` APIs · "More from brand" `replace`-nav · lookbook
`openProduct` creator-tracking nav · CATEGORY_EMOJI / MODE_LABELS / CATEGORY_LABELS.

## Mockup
`design/wave3/flow-49-follower-fashion/web.html` (mirrored to
`04-preview/mockups/web.html`). 2 frames. Founder green-signaled via AskUserQuestion
2026-05-28 ("Green — implement", incl. the accent→ink/yellow correction) BEFORE code.
