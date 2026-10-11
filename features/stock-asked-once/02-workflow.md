# Workflow Definition — Stock asked once

> Step 3. Each numbered step becomes an assertion. Words in quotes are what the screen says.

## Actors
- **Brand** — signed in on the website, approved, on Listings.
- **Shopper** — the shopper app, signed in or a guest.

## Preconditions
- A fashion brand with a store code.
- A one-size leaf (Sunglasses, size system `free_size`) and a sized leaf (T-Shirt, `alpha`).
- For the shopper steps: an approved, live post that carries the product.

## A · A one-size product, added on the website
1. The brand picks **Sunglasses** and lands on Step 1 → there is **no "Stock" box**; Price and SKU are there.
2. Step 2 → the brand ticks **White** and **Black** → there is **no "Size" row**; each colour card shows
   Photos and one box, "Stock for White" / "Stock for Black". An empty box shows "—", never a grey "0".
3. The brand types **20** and **5** → the line under the cards reads "Total stock **25**".
4. Step 4 Review → "White ·20", "Black ·5" and "Total stock: 25". The brand adds the item and saves.
5. The saved product holds White → Free Size → 20 and Black → Free Size → 5, and its own stock number is **25**.
6. Listings → the row shows Stock **25**, status "Live".
7. The shopper opens the post → the product's tile does **not** say "Out of stock".
8. The shopper taps the bag icon → the sheet shows "Colour: White" with White and Black, **no "Size" row**,
   and "Add to bag" is ready without another tap.
9. She adds it → the bag line reads the product with "White · Free Size" (unchanged), at the right price.

## B · The same product, edited
10. The brand opens Edit → Step 2 shows 20 and 5 in the two boxes, and still no "Size" row.
11. The brand sets Black to **0** and saves → Listings shows **20**; in the shopper app **Black is crossed
    out** and White can be bought.
12. The brand sets White to **0** as well → Listings shows **0** and "Out of stock"; the shopper app's tile
    says "Out of stock" and nothing can be added.
13. The brand empties the White box (not counted) → Listings shows "—" and "Live"; the shopper can buy
    White; Black stays crossed out.

## C · A product with sizes
14. The brand adds a T-shirt: Red with M 10, L 12, XL 0 → Step 2 looks as it does today, plus
    "Total stock **22**"; Step 1 has no "Stock" box.
15. Saved: its own stock number is **22**. Listings shows 22.
16. The shopper sees Red XL crossed out and can buy Red M and L (unchanged).

## D · The Excel sheet
17. The brand downloads the template for **Sunglasses** → the columns are Name, Price, Brand, Description,
    the detail columns, Colour, **Stock**, Cover image URLs, Colour image URLs. There is no "Size" column
    and no "Variant stock" column.
18. The brand downloads the template for **T-Shirt** → the same, with **Size** before **Stock**.
19. The brand uploads two sunglasses rows (White 20, Black 5) → one product is created exactly as in step 5.
20. The brand uploads a sheet made from the **old** template (it has a "Variant stock" column) → nothing is
    saved; the page says: "This sheet is from the old template, which asked for stock twice. Download the
    template again, paste your rows into it, and upload."

## E · The server holds the rule on its own
21. Any client (an old copy of the website, a script) sends a product with sizes **and** a product-level
    stock that disagrees → the product-level number is ignored; the saved own number is the total of the
    sizes (or empty when any size is not counted).
22. A product with **no** sizes at all (a furniture piece with only colours) → the product-level stock is
    kept as sent. Its Step 1 keeps the "Stock" box.

## F · What must keep working
23. An order for 1 White → White becomes 19 and the product's own number 24 (as today).
24. A cancelled order gives the unit back → 20 and 25 (as today).
25. A shopper on an app that has not taken the update still sees the "Free Size" chip and can buy.
26. A one-size product listed before this change with a colour and **no** size (a handbag: Red, own stock 4)
    still sells as today; when the brand opens Edit, Red's box already shows **4**.

## Success definition
- No screen offers two places to type stock for the same product.
- For every product with sizes, the own stock number equals the total of its sizes whenever every size is
  counted, and is empty otherwise — after every save, import and order.
- The Listings page and the shopper app can never disagree about whether a product is in stock.
- A one-size product is bought by choosing a colour only.

## Failure / edge workflows
- A colour card with an empty box → saved as "not counted"; never blocks a sale; Listings shows "—".
- A stock that is not a number → saved as empty (not counted), as today. A negative number → saved as 0.
- A one-size product whose every colour is 0 → "Out of stock" on both sides.
- An old-template sheet → refused whole, with the sentence in step 20.
