# Expected Outputs — Stock asked once

> Step 3 (cont.). Defined BEFORE coding. "Compiles" is NOT an expected output.
> Step numbers are those of `02-workflow.md`.

## A · Server checks (`backend/tests/stock-asked-once.test.js`)
| # | Step | Observable output | How it is verified |
|---|---|---|---|
| 1 | 5 | A one-size product posted with two colours holds `colors[].sizes = [{ size: 'Free Size', stock }]` and `brand_products.stock` = 25 | API create, then read the row |
| 2 | 21 | Posted `stock: 99` with sizes 20 + 5 → saved own stock 25, not 99 | API create, read the row |
| 3 | 13 | One size empty → own stock is NULL; `stock.available` is true | API update, read the row |
| 4 | 12 | Every size 0 → own stock 0; the post's card says `in_stock: false`; the deal data says `sold_out: true` | API update, `GET /follower/posts/:id` and `/deal` |
| 5 | 11 | One colour 0, the other 20 → own stock 20; deal data: that colour's size `sold_out: true`, the product `sold_out: false` | same |
| 6 | 15 | A sized product M 10, L 12, XL 0 → own stock 22 | API create, read the row |
| 7 | 22 | A product with no sizes keeps the posted own stock | API create on a leaf with no size axis, read the row |
| 8 | 10 | Edit keeps each colour's stock and rewrites the own number | API update, read the row |
| 9 | 8 | Deal data marks a one-size product `one_size: true`; a product with real sizes `one_size: false`; a product in only "M" `one_size: false` | `GET /follower/posts/:id/deal` |
| 10 | 23–24 | An order takes 1 → size 19, own 24; the cancel gives it back → 20, 25 | the existing ordering tests stay green; one new assertion on a one-size product |
| 11 | — | A negative stock is saved as 0; a non-number as empty | API create, read the row |

## B · The Excel sheet (`backend/tests/stock-asked-once.test.js`, the template and import helpers)
| # | Step | Observable output | How it is verified |
|---|---|---|---|
| 12 | 17 | Sunglasses template headers: no "Size", no "Variant stock", exactly one "Stock" | `columnModel` / the built workbook's header row |
| 13 | 18 | T-Shirt template headers: "Size" then "Stock"; no "Variant stock" | same |
| 14 | 19 | Two sunglasses rows → one item, two colours, each with the leaf's one size and its stock | `buildItems` |
| 15 | 20 | A sheet with a filled "Variant stock" column → a file error with the old-template sentence, no items | `buildItems` |
| 16 | — | The Instructions tab describes "Stock" as the stock of that row | the built workbook |

## C · Website (`Packages/brand-web`, the add / edit product page)
| # | Step | Observable output | How it is verified |
|---|---|---|---|
| 17 | 1 | Step 1 on a fashion leaf has no "Stock" box | looked at in a local preview; screenshot in `06-diff/` |
| 18 | 2–3 | One-size leaf: no "Size" row, one "Stock for <colour>" box per colour, "Total stock" adds up | local preview, screenshot |
| 19 | 14 | Sized leaf: boxes as today, an empty box shows "—", "Total stock" adds up and says when a size is not counted | local preview, screenshot |
| 20 | 4 | Review shows "Total stock: N" | local preview, screenshot |
| 21 | 10, 26 | Edit loads each colour's stock; a one-colour product with no sizes loads its own number into the colour's box | local preview |
| 22 | 22 | A leaf with no size axis still shows the Step 1 "Stock" box | local preview |
| 23 | 6 | Listings shows the total | local preview against the saved product |

## D · Shopper app (`Packages/Mobile`, jest)
| # | Step | Observable output | How it is verified |
|---|---|---|---|
| 24 | 8 | A `one_size` product: the picker has no "Size" label and no size chip | render `ChoicePicker` |
| 25 | 8 | The size sheet's "Add to bag" and "Buy now" are enabled with nothing tapped; what is handed on is `{ colour: 'White', size: 'Free Size' }` | render `SizeSheet`, press |
| 26 | 11 | A colour whose stock is 0 is crossed out and cannot be chosen; the first colour in stock is the one chosen at the start | render `ChoicePicker` |
| 27 | — | "Only 2 left" shows for the chosen colour at 3 or fewer | render `ChoicePicker` |
| 28 | 8 | The product page and the deal page's product pop-up behave the same (ready without a size tap) | render `ProductScreen`, `ProductPopup` |
| 29 | 16, 25 | A product without the flag is unchanged: the "Size" row is there and "Choose a size" until one is tapped | the existing tests stay green |

## E · Live data, at release (`backend/scripts/sync-own-stock.js --dry`, then `--apply`)
| # | Observable output | How it is verified |
|---|---|---|
| 30 | Every product with sizes: own stock = total of its sizes when all are counted, empty otherwise | the script reads back and counts 0 left to fix |
| 31 | No size's stock, no price, no name, no order line changed | fingerprints before and after, identical |
| 32 | No product that was in stock for shoppers is now out of stock, and none the other way | `stock.available` per product, before and after, identical |

## Visual evidence required
- before/after of W1, W2, W3, W4 (website) and S1 (shopper app) in `06-diff/`.
- the two new template header rows, as text.

## Regression gates
- `backend`: the full suite, serial, against the last stored baseline — 0 newly failing.
- `Packages/Mobile`: the full jest suite, all passing.
- `pnpm qa` state reported as it is (the standing red rows are named, never hidden).
