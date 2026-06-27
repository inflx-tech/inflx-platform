# 06 — Before / after notes

**Before:** "All" tile → legacy global Find screen; filter sheet faint/rough.
**After:** "All" → in-world category browser ("All categories"); filter sheet = handle +
rounded pills + solid-pink selected + roomier layout (`04-preview/mockups/filter-sheet.html`).

## Delivered vs mock
- `navigateCategory` All-tile case → `CategoryBrowser { vertical }`; browser vertical-entry
  drills the first segment so the grid isn't empty — matches "stay in fashion world".
- Filter sheet styles updated (handle, radius 22, vpill radius 20, `vpillOn` solid pink) —
  matches the mock.

## Verification
- Mobile babel-compile clean (both files); jest 20/20 (FollowerWallet baseline excluded).
- Capture after OTA + founder re-test.
