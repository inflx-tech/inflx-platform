# 06 — Before / after notes

**Before:** "All" tile → legacy global Find screen; filter sheet faint/rough.
**After:** "All" → in-world category browser ("All categories"); filter sheet = handle +
rounded pills + solid-pink selected + roomier layout (`04-preview/mockups/filter-sheet.html`).

## Delivered vs mock
- `navigateCategory` All-tile case → `CategoryBrowser { vertical }`; browser vertical-entry
  drills the first segment so the grid isn't empty — matches "stay in fashion world".
- Filter sheet styles updated (handle, radius 22, vpill radius 20, `vpillOn` solid pink) —
  matches the mock.

## Filter UI rebuild (founder live-test follow-up 2026-06-27)
The restyled single-scroll sheet still read poorly on-device — the **chips rendered as
tall "long boxes"** (the horizontal chip ScrollView wasn't height-constrained inside the
flex column). Founder gave two reference screenshots (Myntra/Flipkart). Rebuilt:
- **Chips:** wrapped in a fixed-height `chipRow` (48px) → compact dropdown pills (no more
  tall boxes); each facet chip opens the modal focused on that facet.
- **Filter modal → LEFT-NAV pattern:** facet names down the left (Sort + each filter),
  the selected facet's values on the right (radio rows for Sort, checkbox rows for
  filters), `Clear filters` / `Apply` footer. Replaces the single-scroll sheet.

## Verification
- Mobile babel-compile clean (both files); jest 20/20 (FollowerWallet baseline excluded).
- Capture after OTA + founder re-test.
