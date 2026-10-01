# posting-date-last-day — workflow

## W1 · A post goes live
1. She sends a shoppable post to INFLX; INFLX approves it.
2. **At once** it is in the shopper app's feed, her store, the brand's store, search, and opens from
   its link and code. Her screen and the brand's Going live read "Live".
3. If it is an offer post and the offer has not started: it reads "Approved · goes live <start day>,
   when its offer starts"; its link says "This post goes live on <start day>"; on that day it is live.
4. When its offer ends, it leaves the shop (unchanged).
5. Approved after the posting date: live at once all the same, and marked "late" for the brand.

## W2 · The brand gives offers (terms)
1. The offers sheet lists only offers that start on or before the posting date and end after it.
2. Under it: "2 offers aren't listed: one starts 9 Oct, one ends 8 Oct."
3. Sending terms with any other offer is refused: "… has to start by 8 Oct and end after it."

## W3 · The brand gives products without offers
1. The sheet lists only products in no offer from today on.
2. Sending a product that is in an offer, now or later, is refused and names it.

## Build path
Founder's rules (chat, 1 Oct) → this contract → server + both apps → tests → rules doc v1.15 →
**explicit go** → OTA brand, OTA influencer, push (Render). No migration.
