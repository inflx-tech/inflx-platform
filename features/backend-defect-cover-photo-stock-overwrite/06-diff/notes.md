# backend-defect-cover-photo-stock-overwrite — built 11 Oct 2026

No screen changes: there is no board and nothing to compare side by side. This is what the server
does differently.

## Before → after

| | Before | After |
|---|---|---|
| Photo tray save (`POST /listing/products/:id/cover-photos`) | Read the product's whole "colours and sizes" record with no hold, added the photos, wrote the WHOLE record back | Holds the product's row, and writes only the photos (`cover_images`) and the cover picture. Sizes and their stock are not written |
| A sale in the same instant | The sold size was put back (M 3 → 2 → 3); the own number said 2 | The sale stays (M 2); own number 2 |
| A cancelled order in the same instant | The piece that came back was lost again (L 6 → 4) | It stays back (L 6) |
| Older product save with a `stock` (`PATCH /brands/me/products/:pid`) | The own number was worked out from sizes read before the write, with no hold | Read and write are one held step; the own number is the total of the sizes as they are |
| The same save with no stock (Hide, Show, a new price) | — | Unchanged: the same statements, no hold |

## How the fault was reproduced

`backend/tests/cover-photo-keeps-stock.test.js` runs the stock movement of a real order
(`stock.service.moveProducts`) on its own connection and leaves it open, sends the save, waits until
the database shows the save waiting for the row, then lets the order commit. On the code as it was,
three of its checks failed exactly as the fault describes (M back to 3; L back to 4; own number 7
with sizes adding to 6). On the fixed code all 8 pass.

## Decisions taken in the build

1. **Hold the row AND write only the key.** Either alone would close the gap; together the save
   cannot carry sizes even if someone later changes how it reads.
2. **A record stored as text by an older save** has no key to set, so it is written whole as before
   — with the row held. Orders do not move stock inside such a record.
3. **A product with no record** gets `{ cover_images: [...] }`, as before.
4. **The older product save is held only when a stock or sizes are sent.** Hide, Show and a price
   change go through the other branch and are byte-for-byte what they were.
5. **Left, named:** the legacy flat product page can still send its whole typed copy of the record
   through the older save. Fashion brands are redirected away from that page.

## Live data
Read only, 11 Oct: 72 products, 49 with sizes, 0 whose own number is not the total of its sizes.
Nothing to repair; nothing is rewritten at release.

## Not seen
- The photo tray was not opened in a browser: its request and its answer are unchanged, and the
  test checks both (order of photos, the cap of 6, the cover).

## Tests
See `lock.json` → `build`.
