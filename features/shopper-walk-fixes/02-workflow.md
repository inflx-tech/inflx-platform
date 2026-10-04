# shopper-walk-fixes — the flows, step by step

Every step names who acts, what they see, and what the system does. IDs are those of `01-spec.md`.

## 1 · A shopper watches, opens a product, and adds it (V1, V2, O1–O3, O6)
1. Home. A video plays muted. She **taps the video** → it opens full screen in Play, first in line.
2. Play. She swipes up → the old video stops and the new one starts **at that moment**, sound included. The bag icon with its count is beside the sound button.
3. She taps "Shop this video" → **Products in this post**: a grid of three.
   - a discount or price post: no deal box, never "Build your deal";
   - a deal post: the deal and its sentence (said to her), then the grid, then "Build your deal".
4. She taps a **photo** → the **product page**: photos, name, brand, price, colour, size, the listing's details, the returns line, the description. Back returns to the grid.
5. She taps **Add to bag** (the size sheet's or the product page's) →
   the item is added → one short vibration → "✓ Added to your bag" and the button reads **Go to bag ›** for about a second →
   she taps it (→ the Bag) or does nothing (→ everything closes; she is on the same video, where she was).
6. A deal: Build your deal → picks → Review your deal → **Add to bag** → the same second → the review and the deal page close; she is back on the post. (Opened from the Bag's Edit deal: back in the Bag.)

## 2 · The bag (O7)
1. A set, a bundle or a buy-one-get-one is one group: one tick, its items with colour and size, what it costs, **Edit deal**, **Remove deal**. No − 1 + on a single item.
2. A plain discount, buy more save more, and spend-for-a-gift keep − 1 +.
3. Continue → sign in if a guest → address → review → pay (unchanged).

## 3 · The return window (W11, W13)
1. INFLX's admin: Money › Settings › **Return window** → a number and **hours / days** → Save. 1 hour to 365 days. It is the only place.
2. A sale is stamped with the window in force when it is made. A later change never moves it.
3. The brand packs, ships, delivers. Until **Delivered**, nothing is added to anyone: the wallet says "not shipped yet", then "on its way · waiting for delivery".
4. From the delivery the window runs. The wallet says "return window until <day>".
5. The window closes → within the hour: the creator's commission is added to her wallet, the brand's money to its wallet, and INFLX's share counts as earned. Online and cash on delivery alike.

## 4 · A shopper returns something (W14)
1. My orders → a **delivered** item → inside the window it shows **Return** and until when.
2. Return → the reason (five; "Other" needs a note) → what goes back with it (a deal's items together; a gift follows) → what she gets back → Confirm.
3. The item says "Return requested". The brand and INFLX are told. **All three shares of that sale wait.**
4. INFLX's admin, Returns page:
   - **Reject** (a note is required) → she is told why; the sale stands; the shares are added when the window closes.
   - **Approve** → she and the brand are told; the brand collects the item.
   - **Mark refunded** (the item is back) → the item is taken off the order as a cancel would; its stock goes back; the creator's commission leaves her pending earnings; nothing is added to the brand for it; INFLX's share is not taken. An online payment is refunded to where it came from; a cash order is paid back by INFLX by hand.
5. The item says "Returned"; the wallets and the brand's order page say "returned".

## 5 · A creator shares a video; the brand checks it (B2–B4, C1–C7, W15)
1. She adds a video (a shoppable post, or a file for the brand). Her phone uploads the video as before, then makes one picture from it and uploads that too. A phone on an older app build uploads no picture; nothing else changes for it.
2. Going live, her side: each post shows its picture; "4 approved · ✓ Minimum 1 met"; a post approved but not in the shop yet says from which day; each row says "1 file" or "No file yet"; the list below is headed "Share another post, or another place"; Send is one line, and when it is grey a line says which row needs its video.
3. The brand's review: the same pictures on the posts and on each file; the count line reads the same; the file opens with a two-line title; the video plays inside the app on the 30 Sep build.
