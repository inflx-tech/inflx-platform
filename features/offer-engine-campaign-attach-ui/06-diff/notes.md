# Before / After — offer-engine-campaign-attach-ui (Sub-contract C, UI)

**Before** = locked mockup `04-preview/mockups/03-distribute.html` (Screen 03,
in-wizard per-influencer attach). **After** = the campaign wizard offer step
(`campaigns/new/page.js`). Verified by `next build` GREEN (`/dashboard/campaigns/
new` compiles, 28.2 kB).

## Implemented (matches mockup intent)
| Mockup element | Implemented | Match |
|---|---|---|
| "Attach an offer?" → open offer library | "Use a saved offer" `<select>` of active library offers on the per-influencer Offer step | ✓ |
| Per-influencer assignment (same or different offer each) | Picker lives inside the existing per-influencer step → each influencer assigns independently | ✓ |
| Library source + snapshot note | Hint linking to /dashboard/offers + "editing later won't change this campaign" | ✓ |
| Conversion treatment (commission + tracking) | brand_offer_id sent → C-backend `allocation='commissioned'` + existing coupon/commission | ✓ |
| "Using saved offer" confirmation | Green summary replaces the inline builder when a saved offer is picked | ✓ |
| Coexist with inline authoring | "— Author inline below —" restores the existing chips + config builder unchanged | ✓ |

## Intentional deltas (documented, in-scope)
1. **Engagement column / goal-toggle** from the mockup → **deferred to Sub-contract D**. Engagement promotional offers are only follower-actionable via D's store-direct path; shipping the engagement offer UI before D would attach offers followers can't act on. C-UI ships the conversion/hybrid slice (fully functional today).
2. **Open-group group-level** library offers → follow-up. This contract is the handpick per-influencer path (the mockup's emphasis).
3. The mockup is a standalone styled panel; the real implementation lives inside the wizard's existing Offer step, reusing native wizard styling (`.te`/`.oc-types`/`.inp`) — so it visually matches the surrounding wizard rather than the mockup's chrome.

## Verification status
- `next build` GREEN; wizard route compiles with the picker.
- Server side proven by C-backend `offer-attach.test.js` (9/9): invite/update with `brand_offer_id` → snapshot + `commissioned` allocation.
- Live Playwright pixel-capture not run in this authoring environment; a Vercel preview renders the real wizard step for final visual sign-off. Inline-authoring path is byte-unchanged (additive conditional block).
