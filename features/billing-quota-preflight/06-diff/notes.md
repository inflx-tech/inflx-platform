# 06-diff — billing-quota-preflight (A12.1.5)

**Before:** brand on Free tier with admin-set "Active campaigns" quota = 2 + 2 existing campaigns would click "+ New campaign" → navigate to /dashboard/campaigns/new → fill out the entire campaign creation wizard → click Submit → THEN get the QUOTA_EXCEEDED popup. All form work wasted. Founder caught this concretely: "if i try to create new campaign it is opening but it should behave that immediate popup with your quota is over pls select upgrade".

**After:** click "+ New campaign" → button shows "Checking…" → backend evaluates the quota in ~50-100ms → either navigates to the form (if allowed) OR shows the upgrade popup immediately (if blocked). No form work wasted on blocked entries. Same QuotaWallModal component, same styling.

**Backend approach:**
- Extracted shared `evaluateQuota(req, action)` from the quotaCheck middleware. Returns `{would_block, used, limit, current_tier, upgrade_to, feature_key, action}` as JSON.
- The middleware now calls evaluateQuota internally + throws 422 if `would_block: true`. Same gate, same submit-time enforcement.
- New `GET /v1/brands/me/quota-preflight?action=…` endpoint calls evaluateQuota + returns the result. Frontend reads `would_block` to decide.

**Frontend wiring:**
- `/dashboard/campaigns/page.js` — 2 "+ New campaign" entry buttons (the header CTA + the empty-state CTA) replaced from `<Link>` to `<button>` calling `goCreate()`. Both fire the preflight + either navigate or show the modal.
- `/dashboard/products/page.js` — 3 "+ Add product" entry buttons (header CTA + empty-state CTA + add-card CTA) replaced from `setModal('add')` to `openCreateProduct()` which preflights first.
- Both pages now render the QuotaWallModal at root (campaigns page didn't render it before — fixed).

**Fail-open posture:** any error in preflight (network hiccup, transient 500) falls through to opening the form anyway. The brand isn't blocked by infrastructure flakiness; the submit-time gate still enforces if the real over-quota state holds. Worst case is the same as pre-A12.1.5 behaviour.

**Out of scope for A12.1.5:** "+ Add set" and "Invite influencer" buttons inside the campaign creation wizard at /dashboard/campaigns/new — the brand is already inside a form there, the existing submit-time popup fires immediately on click (A9 wiring), no wasted work beyond the modal itself. Can wire preflights there in a follow-up if founder wants.

**Verified locally:** backend boots clean (`node -e require('./src/app')`). pnpm qa main lane unchanged. No new migration. No mobile touch.
