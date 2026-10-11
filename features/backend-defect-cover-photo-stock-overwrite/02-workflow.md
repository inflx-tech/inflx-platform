# Workflow — A photo save must never put sold stock back

## A · The photo tray's save (the defect)

| # | Who | Does | The system |
|---|---|---|---|
| 1 | Brand | Imports products from an Excel sheet; the photo tray opens | unchanged |
| 2 | Brand | Adds one or more photos to a product | the website uploads them and calls `POST /listing/products/:id/cover-photos` with their addresses — unchanged |
| 3 | Server | Saves the photos | **holds the product's row**, reads its cover photos, adds the new ones (6 at most), and writes **only** the cover photos and the cover picture |
| 4 | Shopper | Buys a size of that product at any moment around step 3 | the order waits for the row if the photo save holds it, or the photo save waits for the order; either way the order's stock movement stays |
| 5 | Brand | Sees the photo on the product | the same answer as today |

End state: the photo is saved; every size holds what orders left it; the product's own number is
the total of its sizes.

## B · The older product save, when a stock is sent

| # | Who | Does | The system |
|---|---|---|---|
| 6 | A client | Sends `PATCH /brands/me/products/:pid` with a `stock` (and no sizes) for a product that has sizes | the own number is the total of the sizes **as they are at the moment of writing** — the row is held from the read to the write |
| 7 | A client | Sends the same request with only `is_active`, `price` or any other field | exactly as today: no hold, the same statements |

## Edges

- A product whose record is not in the usual shape (an older save that stored it as text): the
  photo save still works, as today, and is done while holding the row.
- A product that is not the brand's: 404, as today.
- No photos sent: 422, as today.
