# Workflow prediction — Stock asked once

What a person will see and do on the screens of `mockups/stock-asked-once.html`.

**W1 · Website · Add a product · Step 1 "Basics"**
The "Stock" box is not there for any product that has colours and sizes (every fashion product).
Name, Brand, Price, SKU, Description and Tags are untouched. A product type with nothing to count
per colour or size (a furniture piece with only colours) keeps the box, because that box is then the
only stock it has.

**W2 · Website · Step 2 "Variants" · a one-size product**
1. The brand ticks the colours. There is no "Size" row to tick.
2. Each colour card: Photos, then one box, "Stock for White".
3. Under the cards: "Total stock 25", adding up as the brand types.
4. The line under it: "Leave a box empty if you do not count stock for that colour: it then never
   shows as sold out. 0 means sold out."

**W3 · Website · Step 2 "Variants" · a product with sizes**
The Size row and the colour and size boxes are as today. New: the same "Total stock" line and the
same sentence; an empty box shows "—" where it used to show a grey "0" that looked like a number.
When a size is not counted, the total says so ("31, and Blue XL not counted").

**W4 · Website · Step 4 "Review"** — one new line, "Total stock: 25".

**W5 · Website · Bulk add · the Excel sheet**
One "Stock" column, the stock of that row. A one-size product's sheet has no "Size" column: one row
per colour. A sheet made from the old template is refused whole, with a sentence telling the brand
to download the template again.

**S1 · Shopper app · a one-size product** (the bag-icon sheet, the product page, the product pop-up
inside a deal)
1. "Colour: White" and the colour chips. No "Size" row.
2. The first colour that is in stock is chosen already; "Add to bag" and "Buy now" are ready.
3. A colour with none left is crossed out and cannot be chosen.
4. "Only 2 left" for the chosen colour at 3 or fewer.
5. A product with real sizes is exactly as today.

**Not on any screen**
- The server ignores a product-level stock sent for a product that has sizes, and keeps the
  product's own number equal to the total of its sizes. Listings reads that number, so it always
  matches the shopper app.
- At release, the products already on live whose two numbers disagree are brought into line
  (their own number becomes the total of their sizes). No size's stock is changed by that.

**What changes versus today**
| | Today | After |
|---|---|---|
| Where stock is typed, product with sizes | Step 1 "Stock" and Step 2 per size | Step 2 per size only |
| Where stock is typed, one-size product | Step 1 "Stock" and Step 2 "Free Size" | Step 2, one box per colour |
| Listings "Stock" | what was typed in Step 1 | the total of the colours and sizes |
| Shopper, one-size product | taps a colour, then "Free Size" | taps a colour (or nothing) |
| Excel | "Stock" and "Variant stock" | "Stock" |

**Predicted questions from a first-time user**
- "Where did the Stock box go?" → Step 2, next to each colour or size; the total is shown there.
- "I do not count stock." → leave the boxes empty; the sentence under the total says what that does.
- "My old Excel file stopped working." → the refusal names the reason and the fix.
- "Why does my order still say Free Size?" → the order line is unchanged; only the picking is simpler.

**Blast radius**
Website add / edit product page and the Excel template and import; the server's create, edit and
import of a product; the shopper app's colour and size picker. No price, offer, order, return or
wallet code is edited. The brand phone app and the creator app are not edited.
