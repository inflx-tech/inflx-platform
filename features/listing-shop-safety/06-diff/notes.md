# listing-shop-safety — built against the locked board, 11 Oct 2026

Board: `04-preview/mockups/listing-shop-safety.html` — A1–A3, B1 (website), C1 (creator app),
D1 (shopper app). Locked by the founder in chat, 11 Oct 2026 ("ok pls lock it and start
implementation").

## What was implemented

Four fixes from the 11 Oct audit of listing, offers and shopping.

- **A · Hide and zero stock are a pause.** A hidden or sold-out product stays in creators' posts.
  The shop stops showing it (and a post left with nothing to sell) until the brand shows or
  restocks it; then it is back by itself. Only **Remove** is permanent: it says how many live posts
  it will change before the brand agrees, and it is refused for a piece of a running set.
- **B · Saving Edit never puts sold stock back.** The page sends what each stock box showed when it
  was opened; the server moves the live number by what the brand changed, under a lock on the row.
- **C · Place order happens once.** Each attempt carries a key; the same key a second time is
  answered with the order already made (migration 207, one new column on `checkouts`).
- **D · A set is in the shop only while it can be bought whole**, and a piece the set needs twice
  goes into the bag as two.

## Screen by screen

| Board | Built as | Same as drawn? | Looked at |
|---|---|---|---|
| A1 Hide and Show | server only (`shoppablePosts.afterProductChange`, `shopperPosts.livePool`); the buttons are untouched | Yes | Local preview: Hide on one of three products → the post stays approved with 3 products, the shop shows 2; Show → 3 again |
| A2 Remove | `InventoryBrowser.js` (`removeQuestion`, `doRemove`, `bulkRemove`); `brand.controller.js` `deleteProduct` | Yes, words as drawn | Local preview: the question read `It is in 1 live post. It will be taken out of it for good. This can't be undone.`; for a set's piece the red line read `"Piece 2-0" is part of the set "set 2". Hide it to pause the set, or end the offer first.` and all three rows were still there |
| A3 offer panel | `offerPool.postsCarrying`, `offersV2.controller.js` `productOfferPanel` | Yes | Local preview: "Given to 1 creator · in 1 of their posts" (it read 0) |
| B1 Edit, after Save | `listing/page.js` (`stock_was` per size, `stockNotesText`); `listing.controller.js` `updateListingProduct`; `stock.service.js` `mergeStock` | Yes, words as drawn | Local preview, twice: (1) page showed M 1 · L 4, live L was 2, M typed 6 → saved M 6 · L 2; (2) page showed M 6, one sold meanwhile, saved untouched → `Saved. While you were editing, 1 of Blue · M was sold. Its stock is now 5.` and the row holds M 5 · L 2, own 7 |
| C1 creator's post | `PostStatusScreen.js` (blue box `not-in-shop`), `copyCreate.js`, server `shoppablePosts.notInShopWhy` + `postsCopy.js` | **One line differs — see "What diverged"** | **Not looked at on a phone.** 4 jest checks on the rendered screen |
| D1 set piece ×2 | `DealScreen.js` (line qty = the set's quantity; the chosen row says `· ×2`) | Yes | **Not looked at on a phone.** jest on the rendered deal page |

## Decisions taken in the build (none changes a locked screen)

1. **Remove on a hidden product works.** The old code looked only among products on sale, so a
   hidden product could not be removed at all.
2. **Remove is refused only for a piece the shopper must buy** in a set that is published and not
   past its end date (running or scheduled). A free gift of an offer, and a piece of a set that has
   ended, can be removed.
3. **The question's numbers come from the server at the moment of asking** (`posts_live`,
   `posts_only_this`). "It is not in any creator's live post" is shown only when the server said 0.
   If the count cannot be read, the question says what Remove does and claims no number.
4. **The bulk Remove says the same thing without counts** — it loops the same per-product call, so a
   set's piece among the ticked rows is refused and reported in the "failed" count.
5. **Stock merge rule** (`mergeStock`): box untouched → the live number stays; box emptied → empty;
   box changed → live number moved by the change, never below 0; a size that did not exist when the
   page was opened → what was typed. A page that sends no "what I was shown" value (the Excel
   import, an old tab) is saved as sent, as before.
6. **The message lists every size that moved**, one line each; a size that came back (a
   cancellation) reads "came back" not "was sold".
7. **Place-order key**: 8–64 letters, digits, `-` or `_`; made on the phone per review of the
   checkout. Same key + same way to pay → the same order. Same key after the first attempt was
   abandoned → a new order, and the old one gives up the key. A different way to pay under the same
   key abandons the unpaid first attempt and frees its hold.
8. **An app without the update sends no key** and behaves exactly as today.
9. **A set's post needs, for every piece the shopper must buy, stock for the set's quantity of that
   piece** (2 needed, 1 left → not in the shop). A piece whose stock is not counted (empty) is
   treated as available, as everywhere else. A set that allows pieces alone is never held back.
10. **Both units of a ×2 piece are the same colour and size** (told to the founder at the lock).
11. **Two new notices for the creator**: "{product} is not on sale right now" when the brand hides
    it or it reaches 0, "{product} is back on sale" when it returns. The old notice
    ("no longer available") is kept for Remove only.
12. **A post's shop-facing facets (top price, categories) are worked out from its products that are
    on sale.** With none on sale they are left as they were, ready for the return.
13. **Posts removed before this change stay removed** (the rows were deleted then; nothing to
    restore). No data is rewritten at release.

## What diverged from the board

- **C1, one line.** The board keeps the card "Live in the shop · No sales yet" under the new blue
  box. Built: while the blue box shows, the card's title is **"Sales while live"** instead — the
  screen would otherwise say "Not in the shop right now" and "In the shop now." one under the other.
  When the post is in the shop the card reads exactly as before.
- **A2, order of events for a set's piece.** As drawn, the question is asked first and the red line
  comes after OK. So the brand agrees to a warning and is then told it cannot be done. Nothing is
  changed either way. Refusing before asking would need the panel to know about sets; left as drawn.
- Nothing else in layout or words.

## Tests pinned to the old rule, updated (assertion drift from an approved rule change)

- `shoppable-posts-v2.test.js` — "hiding a product takes it out of posts" and "a zero-stock save
  removes the post" now assert the pause: rows kept, post approved, not in the feed, back on Show /
  restock.
- `creator-terms-v2.test.js` — off sale now sends the "not on sale right now" notice; "no longer
  available" is asserted for Remove; back on sale sends the new notice.
- `order17.test.js` (phone) — Place order's body now carries `place_key`.
None was loosened or skipped; each asserts more than before.

## Not seen

- No phone screen has been looked at on a device: the creator's blue box, the ×2 set piece, and a
  second tap on Place order. They wait on the founder's walk.
- The local preview's payments are mocked; the "same key twice, online" case is proven by the API
  test (one pending checkout, one hold, the same Razorpay order), not by a real payment sheet.
- The Next.js development-mode "1 error" badge on Listings (a text mismatch while the page loads)
  is still there in the local preview. It shows with the unchanged page too and does not exist in a
  production build.

## Tests
See `lock.json` → `build`.
