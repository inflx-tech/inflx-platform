# 06 — Before / after notes

**Before** = the locked picker mock `04-preview/mockups/category-picker.html`.

**After** = the live App Builder section editor: "Category rail (pick from catalogue)"
preset → tree pick list + selected-tiles list, on the real fashion/furniture tree.
Follower side: the picked categories render as a rail; tap → Phase-1 CategoryBrowser.
Capture pending Vercel admin deploy + OTA + founder live-test (no Maestro device;
`release.released` stays false per program precedent).

## What the implementation delivers vs the mock
- New preset "Category rail (pick from catalogue)" (`shelf_type:'nav_tiles', rule:'category_nodes'`) — matches.
- Tree pick list (indented, tap-to-toggle, ✓ on selected) reusing the section-library
  drill pattern — matches.
- Selected-tiles list with rename + icon + remove — matches.
- Picker gated to fashion/furniture worlds — matches (mock shows Fashion).
- Backend `category_nodes` rule emits tiles carrying `category_node_id`+vertical; mobile
  `nav_tiles` mapper passes them through → tap opens CategoryBrowser.

## Verification
- Backend: `category_nodes` registered; load clean. `pnpm qa` green (see release notes).
- Admin: `npm run build` (brand-web) exit 0.
- Mobile: `SectionRenderer.js` babel-compile clean; jest unchanged-green.
- Live founder test on OTA/Vercel = final sign-off.
