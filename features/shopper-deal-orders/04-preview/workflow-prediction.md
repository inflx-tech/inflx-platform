# Workflow prediction — shopper-deal-orders (the screens on the board)

One or two lines per screen on the board: what she does → what she sees. Nothing is built yet; this is what the app is expected to do once the board is locked.

The example on every screen: Akshaya Reddy's post for Aveen fashion boutique and desiner studio, "Any 3 for ₹2,999". Anusha K took Premium Polo T-Shirt · M (₹1,299), Oxford Shirt · M (₹1,499) and Slim Jeans · 32 (₹1,999): ₹4,797 at normal prices, she paid ₹2,999 and saved ₹1,798. Each item's share of the ₹2,999: ₹812, ₹937, ₹1,250.

## A · My orders shows a deal as one

- **O1** · She opens My orders → three cards. The bundle is one card: "Any 3 for ₹2,999", its three items, "Delivered · Sun, 4 Oct", ₹2,999. The buy-one-get-one pair is one card too. The Blue polo, a plain 20% off, is a card of its own. The filters are the ones she has today.
- **O2** · She taps the bundle's card before it has shipped → the deal's page, titled "Confirmed": the three items with colour and size, "Paid ₹2,999 · UPI, cards, net banking", one timeline, the address, "See the post · from Akshaya's post", and one red-outline button, "Cancel deal".
- **O3** · She taps Cancel deal → the three items listed, "Why are you cancelling?" with the reasons she has today, and "Refund of ₹2,999 to your original payment method in 5–7 working days." She picks a reason and taps Cancel deal → all three are cancelled together and the whole deal is refunded.
- **O4** · She opens the same deal after it was delivered → the page is titled "Delivered", with one button, "Return or replace", and under it "You can return this until Sun, 11 Oct, 4:30 pm."

## B · One item of a deal is not right

- **R1** · She taps Return or replace → two large choices: "One item is not right · Replace it. The deal stays." and "Return the whole deal · All 3 items go back. Refund of ₹2,999."
- **R2** · She taps One item is not right → she picks which item (Slim Jeans · 32) and what is wrong: "The size doesn't fit", "It arrived damaged" or "It isn't as shown", then Continue.
- **R3** · She chose "The size doesn't fit" → the jeans' sizes: 30, 32 crossed out (the one she has), 34, 36 crossed out (sold out). She taps 34 → "Replacement: Slim Jeans · 34. The deal stays and no money moves." and "The store brings it and collects the 32." She taps Request replacement.
- **R4** · She chose "It arrived damaged" (or "It isn't as shown") and the store has one more → "Replace with the same item · Slim Jeans · 32", in stock. She writes what is wrong and taps Request replacement.
- **R5** · The same, but the store has no more of it → "The store has no more of this. INFLX refunds this item's share: ₹1,250. You keep the rest of the deal.", the two items she keeps, and the button "Request refund for this item".
- **R6** · On R1 she taps Return the whole deal → the three items, "I changed my mind" or "Other (write a note)", "Refund of ₹2,999 to your original payment method once the items are back.", and Request return. This is today's return.
- **R7** · She chose "The size doesn't fit" and no other size is in stock → every size is crossed out, "No other size is in stock. You can keep it, or return the whole deal.", and the button "Return the whole deal", which opens R6.
- **R8 · 1 of 3** · Right after she asks → the deal's page shows a box: "Replacement requested · INFLX is looking at it." The same words are on the deal's card in My orders.
- **R8 · 2 of 3** · INFLX approves → the box reads "Replacement approved · The store will bring Slim Jeans · 34 and collect the 32."
- **R8 · 3 of 3** · The store has brought it → the box reads "Replaced · Slim Jeans · 34 delivered Wed, 7 Oct.", and the jeans in her deal now read Indigo · 34. No money has moved.
- **R9 · brand website** · The store opens Order Fulfillment → a card "Replacement to send · Anusha K": send Slim Jeans · 34, collect Slim Jeans · 32, and her address. It taps Mark sent, and later marks it delivered, like a parcel. The card says "Nothing is added to or taken from your wallet for a replacement."
- **R10 · admin** · INFLX opens Returns → each request names its kind: "Replace" (Slim Jeans · 32 → 34, the size doesn't fit), "Refund one item" (Slim Jeans, ₹1,250, it arrived damaged and the store has no more), "Return" (the whole deal, 3 items, ₹2,999, I changed my mind). Each has Approve and Reject.

## C · Buying one item alone

- **B1** · On the bundle post she opens Slim Jeans → the product page shows ₹1,999, the line "Buy this alone · ₹1,999" over Buy now and Add to bag, and under them the strip "In an offer: Any 3 for ₹2,999 · See offer ›". See offer opens the deal with the jeans started.
- **B2** · On the buy-one-get-one post she opens a product → no "alone": one yellow button, "Get this offer", and the line "Buy one, get one free. Pick your free one next."
- **B3** · On a set post she opens a piece → the line "Sold as a set." and the one button "Build your deal". If the brand has switched on "Pieces can also be bought alone" for that offer, she sees the two choices of B1 instead.
- **B4** · In "Products in this post" on the bundle post she taps the bag icon on Slim Jeans → the size sheet: colour, sizes, Buy now and Add to bag at ₹1,999, and under them "Or get it in the offer: Any 3 for ₹2,999 ›". "Build your deal" is still at the foot of "Products in this post".
- **B5** · She adds the jeans alone and opens her bag → an ordinary row under Akshaya's post: − 1 +, Change, Remove, ₹1,999, and the nudge "Add 2 more from this post and get all 3 for ₹2,999 · See offer ›".
- **B6** · She adds the T-shirt and the shirt from the same post → the three are one deal in the bag: one tick, "Any 3 for ₹2,999", ₹2,999 with ₹4,797 struck, Edit deal, Remove deal, and the green line "The offer applied by itself." She was not asked. The total is ₹2,999.
- **B7 · brand website** · The brand builds a set offer → one new switch, "Pieces can also be bought alone", off to begin with, with "Off: the set is sold only whole. On: a shopper may also buy one piece at its normal price." Everything else in the builder is as today.

## T · The table

- **The table** · By kind of offer: which are one card in My orders, which can be bought alone, which can have one item replaced, and when one item's share is refunded. Plain discounts stay per item; a bundle and buy more save more get all four; a set is bought alone only if the brand allows; a buy-one-get-one pair goes back together; with a gift offer each item stands alone and the gift follows what earned it.

## Not drawn

- A saved product opening its product page (the page is B1, B2 or B3).
- What she sees when INFLX does not accept a replacement, and an order paid in cash on delivery.
