# stock-asked-once — built against the locked board, 11 Oct 2026

Board: `04-preview/mockups/stock-asked-once.html` — W1–W5 (website), S1 (shopper app).
Locked by the founder in chat, 11 Oct 2026 ("yes pls lock it and start implementing same").

## What was implemented

Stock is typed in one place. The server keeps a product's own number (`brand_products.stock`) equal
to the total of its sizes on every save, import and order, and never takes it from what a page
sends. The website's Add / Edit product page no longer has a "Stock" box in Step 1; a one-size
product (sunglasses, a watch, a bag, a saree) has one stock box per colour and no "Size" row. The
Excel sheet has one "Stock" column. The shopper app asks a one-size product for a colour only.

## Screen by screen

| Board | Built as | Same as drawn? | Looked at |
|---|---|---|---|
| W1 Step 1 "Basics" | `listing/page.js` — the Stock box shows only for a product type with nothing to count per colour or size (`!stockKey`) | Yes. Name, Brand, Price, SKU, Description, Tags untouched | Local preview, Sunglasses and T-Shirt: `after/W1-step1-sunglasses-no-stock-box.jpg` |
| W2 Step 2, one-size product | same page — no Size row; each colour card has "Stock for {colour}"; "Total stock"; the sentence | Yes. Section title reads "Photos & stock — per colour" | Local preview: `after/W2-step2-sunglasses-one-box-per-colour.jpg` (White 20 + Black 5 → 25) |
| W3 Step 2, product with sizes | same page — boxes as before; an empty box shows "—"; "Total stock"; the sentence says "that size" | Yes. With XL emptied: "22, and Red XL not counted" | Local preview: `after/W3-step2-tshirt-sizes-and-total.jpg` |
| W4 Review | "Total stock: N" under the colour pills | Yes | Local preview: `after/W4-review-total-stock.jpg` |
| W5 Excel sheet | `listingBulk.service.js` — one "Stock" per row; no "Size" on a one-size leaf; old sheet refused | Yes. Sentence exactly as drawn | Templates downloaded from the local server for the real Sunglasses and T-Shirt leaves and read; the refusal through the upload API (test) |
| S1 shopper app, one-size product | `orderBits.js` (`ChoicePicker`, `SizeSheet`, `ProductPopup`), `ProductScreen.js` | Yes in behaviour: colours only, first colour in stock chosen, buttons ready, a sold-out colour crossed out, "Only 2 left" for the chosen colour | **Not looked at on a phone.** 17 jest checks on the rendered components |

**Add, walked to the end in the local preview**
Sunglasses → name and price → White and Black, a photo for White → 20 and 5 → "Total stock 25" →
Frame shape → Review ("White ·20 · Black ·5 · Total stock: 25") → "+ Add this item" (the tray reads
"2 colour(s) · stock 25") → Save. The saved row: White → Free Size → 20, Black → Free Size → 5,
own stock 25, size facet ["Free Size"].

**Edit, looked at in the local preview**
- A product saved the old way with "Stock 20" and Free Size 0 opens with "Stock for White: 0" and
  "Total stock 0" — the page now shows what the shopper app was being told. Set to 20, saved:
  Listings shows 20; the row holds White → Free Size → 20 and own stock 20.
- A one-size product saved with a colour and no size (a handbag, own stock 4) opens with "Stock for
  Red: 4".

## Decisions taken in the build (none changes a locked screen)

1. **What "one-size" means for the shopper app is decided by the server, from the product itself**:
   every colour holds exactly one size and its name is "Free Size", "One Size" or "Unstitched". A
   shirt listed in "M" only keeps its Size row. Sent as `one_size` in the deal data; an app without
   the update ignores it and shows the "Free Size" chip as before.
2. **The first colour that is in stock is the one chosen at the start**, so "Add to bag" is ready
   at once. With one colour there is nothing to tap.
3. **Every colour sold out reads "Sold out"**, not "Sold out in every size".
4. **The older product endpoints hold the rule too** (`POST /brands/me/products`,
   `PATCH /brands/me/products/:pid`). No live screen sends a stock through them for a fashion
   product, but the rule must not depend on that.
5. **A stock that is not a number is saved as empty; a negative one as 0.** (A non-number used to
   stop the save with a database error.)
6. **A colour on two rows of a one-size sheet is refused**, naming the product, the colour and the
   row. Before, there was a Size column to tell rows apart; now the colour is the row.
7. **An old-template sheet is recognised by its "Variant stock" column, filled or empty.**
8. **The old-template message is not followed by the page's usual "Download a fresh template…"
   line** — it already says it.
9. **Review's colour pills now add up only the sizes that colour has.** They used to add every
   number ever typed for the colour, including a size since switched off.
10. **The staged-items tray shows the same total the server will keep.**
11. **Furniture is untouched**: a leaf with no Size choice keeps Step 1's Stock box and its old
    sheet columns.

## Two faults found on the way, inside this rule, and fixed

- **A product whose own number was empty stayed "in stock" after its last unit sold.**
  `stock.service.js` compared `Number(null)` (0) with the sizes' total (0), saw no difference and
  left the number empty — so the shop feed kept the post. Now an empty number is reset too.
- **A product with colours and no sizes could never say "sold out" on the deal page** — it fell
  between "its sizes decide" and "its own number decides". It now answers from its own number, as
  the bag and checkout already did.

## What diverged from the board

- None in layout or words.
- **Not drawn, and added:** the refusal for a colour listed twice in a one-size sheet (decision 6).
- **Not shown on the board, true of the build:** a product with one size left empty shows "—" on
  Listings (its own number is empty), while Step 2 says e.g. "22, and Red XL not counted".

## Not seen
- No screen has been looked at on a phone. The shopper change waits on the founder's walk:
  a sunglasses post → bag icon (colours only, Add to bag ready) → the product page → inside a deal.
- A product type with no Size choice (furniture) was not opened: the preview brand is a fashion
  brand. Its Step 1 box is kept by one condition in the page (`!stockKey`).
- The local preview shows a Next.js development-mode "1 error" badge on the Listings page (a
  text mismatch while the page loads). It shows with the unchanged page as well; it is not from
  this work and does not exist in a production build.

## Tests
See `lock.json` → `build`.
