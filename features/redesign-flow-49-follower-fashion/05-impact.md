# Flow 49 — Impact analysis

## Verdict (chat one-liner)
**Zero functional disturbance — visual + UX only.** Two fashion screens move dark→
light brandPalette; the per-business accent is relocated to wayfinding tints (CTAs/
prices → ink+yellow/ink-mono per F0). All CTA dispatch, tracking, discount math, and
APIs preserved verbatim.

## Classification
- **production-impacting** — follower OTA bundle serves the restyled screens.
- Mobile JS-only; no backend, no migration, no native rebuild (NATIVE_RUNTIME=2).
- Brand/influencer carry the shared bundle (no brand/influencer-screen change).

## Preserved verbatim (NON-NEGOTIABLE)
| Concern | Preservation |
|---|---|
| availing_modes CTA dispatch | online_order→Buy / walkin_pay→Pay / prebook→Book / enquiry→Enquire + category-aware verb maps (CATEGORY_LABELS/MODE_LABELS) unchanged |
| dispatchCta nav | navigates to OnlineOrder/PayAtStore/PreBook/Enquiry with offer/brand/store/influencer/product + 4-ID tracking |
| Discount math | percentage/flat/bogo/bundle/volume/gift badges + finalPrice/savings computation unchanged |
| APIs | `getStoreProducts(handle,{offerId,ciId})`, `getLookbook(handle,lookbookId)` unchanged |
| More-from-brand | `navigation.replace('ProductDetail', …)` with full params unchanged |
| Lookbook openProduct | creator-attribution `tracking` (influencer_id) → BrandStore nav unchanged |
| Type emoji | CATEGORY_EMOJI map kept (per the design-language "keep type/category emoji" rule) |

## Design correction (founder-approved)
Per-business accent moved OFF primary CTA + prices (F0 violation in the dark version)
→ ink+yellow CTA, ink-mono prices, successText savings; pink retained only for hero/
image tints (wayfinding). Approved via AskUserQuestion ("Green — implement").

## Risk
- **Regression risk: low.** No control-flow/prop changes; restyle is token + inline-
  color reclassification + StyleSheet rewrites. Verified by 0-orphan grep + babel (2/2)
  + 25-marker grep.
- **Rollback:** OTA version pin to follower v61 (Flow 48).

## After-evidence
Emulator after-screenshots SKIPPED (deep, data-gated detail screens). After-evidence =
the mockup + founder physical APK smoke-test on live follower v62.

## Mockup sign-off
Founder green-signaled via AskUserQuestion 2026-05-28 ("Green — implement") BEFORE any
screen code. `mockup_locked=true`.
