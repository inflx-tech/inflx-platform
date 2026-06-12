# Before / after — Universal Share Links

**Before:** only influencer stores had a share scheme (`/s/:handle`), and even
its Share button was a dead placeholder (no `onPress`). Brand stores, products,
and offers had no share URL and no copy/share UI anywhere.

**After:** all four are shareable.
- **Backend:** `GET /b/:id` (brand), `/p/:id` (product), `/o/:id` (offer) mirror
  `/s/` — log the click + 302 to the follower deep path, preserving any
  `cid/sid/oid/iid`.
- **Mobile:** `utils/shareUrl.js` builds one canonical link per target;
  `shareTarget` opens the native share sheet (also copyable). Wired into the
  influencer Share button (was dead), a new "↗ Share store" chip on the brand
  page, and the product hero ↗ icon (shares the product, or the offer when it's
  an offer context).

**Flagged (not a regression):** tapping a shared link doesn't yet open the app
on the exact screen — that needs native intent-filters (next APK). The
copy/share action works now.

**Verification:** backend live smoke — `/b /p /o` → 302 to `/business|/product
|/offer/:id` with query preserved, `/s` unchanged. All touched mobile screens
parse clean. `pnpm qa` GREEN.

**Capture note:** before = dead placeholder / no UI; after = founder device
walk sharing from each of the four surfaces (release gate). Backend smoke is the
automated proof.
