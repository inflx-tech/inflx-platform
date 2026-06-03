# Before / After — offer-engine-store-mobile (D3b)

**Before** = locked Screen 04 (`04-store-preview.html`) — follower store with
STORE DEAL + brand-direct buy. **After** = the follower app's BrandStoreScreen
"Store Deals" tab + PayAtStore store-direct mode.

## Implemented (matches mockup intent)
| Mockup (Screen 04) | Implemented | Match |
|---|---|---|
| Store-published offers visible to followers | "Store Deals" tab listing `store_offers` (conditional) | ✓ |
| STORE DEAL — buy directly, no influencer | Buy → PayAtStore storeOffer mode → /follower/store-offer/pay+verify | ✓ |
| No commission, full brand margin | Enforced server-side (D2): commission 0, offer_source='store' | ✓ |
| Direct vs influencer path comparison | Influencer purchase path untouched; store path is a separate branch | ✓ |

## Intentional deltas (documented)
1. Store deals listed in their own **tab** (reusing the influencer-card layout) rather than as ribbons on the product grid — product-card STORE DEAL ribbons are a follow-up.
2. Buy reuses the existing **PayAtStore** screen in `storeOffer` mode (bill entry + Razorpay + receipt shared) rather than a bespoke checkout.
3. The mockup's "direct vs influencer" annotation is informational; the app realises it as two code paths (influencer untouched).

## Verification status — IMPORTANT
- Server endpoints proven by D2 `offer-store-direct.test.js` (4/4).
- **Mobile E2E NOT run pre-merge** — the Maestro gate was **overridden**
  (`GOVERNANCE_OVERRIDE`, founder-authorised 2026-06-03). On-device
  `pnpm qa:maestro` (flow `05-follower-store-deal.yaml`, currently permissive) +
  a manual smoke + the OTA publish are the immediate follow-ups. Runtime
  confidence pre-merge rests on mirroring the existing pay-at-store flow + green
  server tests, NOT an on-device pass.
- No screenshot capture in this environment; Screen 04 is the design reference.
