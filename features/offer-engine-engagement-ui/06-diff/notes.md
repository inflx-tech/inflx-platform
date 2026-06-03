# Before / After — offer-engine-engagement-ui (D3a)

**Before** = locked Screen 03 (`03-distribute.html`), engagement column of the
goal toggle. **After** = the campaign wizard offer step shown for engagement
goal. Verified by `next build` GREEN (`/dashboard/campaigns/new`, 28.3 kB).

## Implemented (matches mockup intent)
| Mockup (engagement column) | Implemented | Match |
|---|---|---|
| Offer attachable in an engagement campaign | Offer section now appears for engagement goal | ✓ |
| Promotional only — no commission, no tracking | Copy says so; commission/coupon fields not shown; payload sends none | ✓ |
| Pick a saved offer for the influencer to feature | Reuses the C-UI saved-offer picker | ✓ |
| Followers buy it as a store deal | Backed by D1 (surface) + D2 (store-direct purchase); mobile render = D3b | ✓ (mobile UI in D3b) |
| allocation = promotional | Backend (C-backend) derives it from the engagement goal | ✓ |

## Intentional deltas (documented)
1. Implemented inside the real wizard's per-influencer Offer step (native styling) rather than the standalone mockup panel.
2. The mockup's goal toggle maps to the real campaign-set goal (engagement vs conversion are separate sets).
3. The follower-facing STORE DEAL render + buy button (Screen 04) is **D3b** (mobile) — not part of this brand-web slice.
4. Offer is **optional** for engagement (pure-engagement campaigns unchanged); conversion/hybrid offer flow byte-unchanged.

## Verification status
- `next build` GREEN.
- Engagement attach proven server-side by C-backend `offer-attach.test.js` (engagement + brand_offer_id → allocation='promotional', no commission/coupon).
- Live Playwright capture not run here; Vercel preview renders the real wizard for final sign-off.
