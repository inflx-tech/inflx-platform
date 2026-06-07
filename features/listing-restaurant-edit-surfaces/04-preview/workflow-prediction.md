# Workflow Prediction — Wave 2b brand-web (dish capture + honest saves)

Mockups: `mockups/01-add-dish-card.html`, `mockups/02-publish-result.html`.

## 01 — Manage Menu dish cards
- A tapped master dish is added with a **blank photo** (no stock/dummy image) — a
  "📷 Add photo" placeholder. (`RestaurantDishPicker.handleAddFromMaster` line 150:
  `image_url: masterRow.default_image_url` → `null`; search/custom paths already blank.)
- Each dish shows an explicit **per-dish capture**: editable **price** (master price may
  pre-fill as an overridable hint; field highlighted until set) + **Add your photo**.
  Items still missing a photo/price show a gentle nudge.
- Dishes are **grouped by section** (backend section fix already shipped) — no
  "Uncategorized".
- The **"Edit business setup" door** stays separate from the everyday menu (two-door).

Predicted outcome: owner adds dishes quickly, sets only their own price + photo, and the
menu looks like a real restaurant menu (sectioned, own photos), not a stock-photo grid.

## 02 — Honest publish result
- Publish reports the **real** count saved. If saves fail, it shows the **real reason**
  (e.g. "account under review", validation) and does NOT show "You're live".
  (`lib/api.js` returns `{success:false}` without throwing; `publishDriver` must check
  `res.ok`/`res.success`, only count real saves, collect errors; Done screen renders them.)
- With **build-while-pending** (backend, decision A), the pending-approval case is removed
  at the source — the menu saves while pending and auto-goes-live on approval.

Predicted outcome: the "+18 MENU / You're live" lie can never happen again; the owner
always sees the true state of their save.

## Out of this mockup (separate, backend, no mockup)
- Free location short-link expansion (geocoding).
- Build-while-pending gate removal + follower-visibility guard.
- One-time backfill of existing dishes' section from the master dictionary.
