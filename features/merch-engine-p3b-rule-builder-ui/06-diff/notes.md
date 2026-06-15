# 06-diff notes — Phase 3b (Section rule-builder UI)

Implemented to the locked mockup (`04-preview/mockups/section-library.html`), navy admin theme.

## What was implemented
- **Admin page** `app/admin/section-library/page.js` + nav link "Section Library" (🧩).
  - List grouped by business, each row = name + rule chips (sub-category / #tags / price / sort) + Edit/Hide.
  - **Builder modal**: Name · Business (the active follower tiles) · Sub-category tree
    (loaded from `GET /listing/tree?vertical=`, shown for fashion/furniture; "Any" + indented
    nodes; hidden with a note for businesses without a tree) · Tags (from
    `GET /admin/tag-vocabulary?scope=<business>`, multi-select) · Min/Max price · Sort · Image.
  - **Live preview** panel: debounced `POST /admin/section-library/preview` → big match count
    (with "+" when capped at 200) + sample thumbnails + the gating/context note.
- **Backend** `adminSectionLibrary.controller.js` + routes (`/admin/section-library` GET/POST/PATCH,
  `/admin/section-library/preview` POST), all `requireAnyAdminRole`. Preview runs the 3a
  evaluator at platform scope.
- **api.js** adminApi: list/create/update/preview + getListingTree.

## Mockup → build: what matches
- The 5 filter fields, the tree picker (node + descendants), the tag chips, the live count +
  sample strip, and the navy theme all match the locked mockup.
- Copy preserved: "place it on a screen (next step)"; the gating/context note in the preview panel.

## What diverged (intentional / honest)
- Business options come from the live **active follower tiles** (not a hardcoded 5), so the
  list always matches admin's current tiles.
- Preview count is capped at 200 (shows "200+") to keep the admin query cheap — the founder's
  current inventory is well under that, so counts are exact in practice.
- Sub-category tree only for fashion/furniture (data reality); other businesses show a note.

## What to check in prod (founder)
- Open Admin → **Section Library** → New section → Fashion → tree loads → pick Jeans, tags,
  price ≤ 499 → preview shows a real count + samples → Save → row appears. Edit + Hide work.
- Non-tree business (Food) → sub-category hidden, rest works.
- Nothing appears to followers yet (placement = 3c).
