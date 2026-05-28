# Flow 47 — Impact analysis

## Verdict (chat one-liner)
**Zero functional disturbance — visual + UX only.** RestaurantDetailScreen converges
to brandPalette; dispatchAction, 4-ID tracking, local cart, CTA branching, and the
reviews/meals APIs preserved verbatim.

## Classification
- **production-impacting** — follower OTA bundle serves the restyled screen.
- Mobile JS-only; no backend, no migration, no native rebuild (NATIVE_RUNTIME=2).
- Brand/influencer carry the shared bundle (no brand/influencer-screen change).

## Preserved verbatim (NON-NEGOTIABLE)
| Concern | Preservation |
|---|---|
| `dispatchAction` | call/directions/book/pay/order/enquiry → PreBook/PayAtStore/OrderCart/Enquiry nav unchanged |
| 4-ID tracking | `tracking` prop threaded into every nav (PreBook/PayAtStore/Enquiry/ProductDetail/RestaurantCart) |
| Local cart | addToCart/decFromCart/cartCount/cartTotal/`goToCart` items mapping unchanged |
| CTA branching | showBookTable/showPayAtStore/showOnlineOrder/showEnquiry; cart-bar vs action-bar |
| Offer selection | best-across-influencers `useMemo` unchanged |
| Tabs / carousel | tab state, sections grouping, photo carousel index unchanged |
| APIs | `mealsApi.getStore`, `getBrandReviews`, `getReviewable`, `postReview` byte-for-byte |
| BrandStore path | inline-render for `category==='restaurant'` — BrandStore untouched |

## Risk
- **Regression risk: minimal.** Pure palette swaps across 3 StyleSheets + inline; no
  control-flow or prop changes. Verified by 0-orphan grep + babel + 3 restaurant jest
  suites green + 18 logic-marker grep.
- **Rollback:** OTA version pin to follower v59 (Flow 46).

## After-evidence
Emulator after-screenshots SKIPPED (deep, data-gated detail screen). After-evidence =
the mockup + founder physical APK smoke-test on live follower v60.

## Mockup sign-off
Founder green-signaled via AskUserQuestion 2026-05-28 ("Green — implement") BEFORE any
screen code. `mockup_locked=true`.
