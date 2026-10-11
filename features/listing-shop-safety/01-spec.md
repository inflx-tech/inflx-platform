# Feature Spec — Listing and shop safety: four fixes

> Raised by the founder on 11 Oct 2026 from the audit of the seams between listing, offers and
> shopping ("Ok pls first 1 to 4 now"). Two rule choices were put to him the same day and answered:
> **"Pause, comes back"** for a hidden or zero-stock product, and **"Hide until whole"** for a set
> with a piece missing.

## The four problems

| | What goes wrong today | Example |
|---|---|---|
| **A** | Hiding a product, or saving its stock as 0, takes it out of creators' posts for good. A post left with nothing is removed and never comes back. Hide is one click with no warning, and the product panel always says "in 0 of their posts". | "Spider man x" carries only Spider man glasses. One mistaken tap on Hide and the post is gone; Show does not bring it back. |
| **B** | Saving the Edit product form writes every size's stock back to what the form showed when it was opened. | Edit opened at 10:00 with Blue · M = 3. Two are sold at 10:05. A description fix saved at 10:10 puts M back to 3. |
| **C** | "Place order" has no once-only guard. | The server is slow, the app says "please retry", she taps again: two cash-on-delivery orders. Or, paying online, her first try holds the last piece and her retry says "Sold out". |
| **D** | A set stays in the shop when one piece is hidden or sold out, but can never be bought ("Sold only as the whole set"). A set that needs 2 of one piece cannot be picked on the phone at all. | "Bundle offer", 3 pieces for ₹5,000: one piece sells out, the post still shows "SET FOR ₹5,000". |

## Survey — what exists today (looked at)

| # | Capability | Verdict | Evidence |
|---|---|---|---|
| 1 | Hide on Listings | Works, destructive | `InventoryBrowser.js` `doToggle` → `PATCH /brands/me/products/:pid { is_active }`, no confirm → `shoppablePosts.afterProductChange`: `DELETE FROM post_products …`, then `removePosts(empty, 'unavailable')` |
| 2 | Remove on Listings | Works, same effect as Hide plus a confirm that states nothing | `doRemove` → `DELETE /brands/me/products/:pid` (sets `is_active = false`) → the same `afterProductChange` |
| 3 | Stock 0 on a brand save | Works, permanent | `afterProductChange`: `after.stock === 0` → posts whose products are all at 0 → `removePosts(…, 'sold_out')` |
| 4 | Stock 0 through orders | Works, a pause | `stock.service` never calls `afterProductChange`; the shop's `livePool` simply stops listing the post, and a cancel brings it back (shopper-app-fixes F6, approved 5 Oct) |
| 5 | A removed post coming back | **Missing** | nothing sets `creator_posts.status` back from `'removed'` |
| 6 | "in N of their posts" on the product panel | **Broken** | `offersV2.controller.js` `productOfferPanel`: `posts: 0` hard-coded |
| 7 | Edit product saves stock | Works, overwrites | `listing.controller.js` `updateListingProduct`: `variants_json = $6::jsonb` from the form, no lock, no compare |
| 8 | Place order once | **Missing** | `shopperCheckout.service.js` `place()`: no key, no duplicate check; the phone's request times out at 30 s and offers a retry |
| 9 | A set needs every piece | Works | `orderPricing.service.js` `case 'fixed'`: every pool product × its quantity, else "Sold only as the whole set" |
| 10 | A set's post leaves the shop when it cannot be bought | **Missing** | `shopperPosts.livePool`: a post is live while ANY one of its products is on sale and in stock |
| 11 | A piece needing ×2 | **Broken on the phone** | `DealScreen.js` `primary()`: `qty: sel.qty || 1`, and the set pop-up has no quantity; the server needs `quantities[pid]` |
| 12 | The offer page refuses taking a piece out of a set | Works | `offerLife.removalPlan`: "A fixed bundle is exactly these products…" — Listings' Remove walks around it |

## Scope

### A · Hidden and out of stock are a pause; Remove is the permanent one
- **Hide** (and the older "unpublish" switch): the product is not sold or shown while hidden. It
  STAYS in creators' posts and is simply not shown there. A post with nothing else to sell is not
  in the shop meanwhile. **Show** brings all of it back. Creators are told "not on sale right now",
  and "back on sale" when it returns.
- **Stock 0 saved by the brand**: the same as selling out through orders. Nothing is removed. A post
  whose products are all out of stock is not in the shop until one is restocked.
- **Remove** stays permanent: the product is hidden AND taken out of every post for good; a post
  left with nothing is removed. Before it happens the brand is told the real numbers.
- **Remove is refused** for a product that is a piece of a set that is running or scheduled — the
  same refusal the offer page gives — with a way forward: hide it (a pause), or end the offer.
- The product panel's "in N of their posts" is the true count.
- The creator's own post page says so when her live post is not in the shop right now, and why.
- The post's price band and categories are worked out from the products on sale.

### B · Saving Edit never brings back sold stock
- The form sends, with each size, the stock it showed when it was opened. The server, holding the
  product's row, saves: a box the brand did not touch → the live number stays; a box the brand
  changed → the live number moves by the same amount (3 shown, 10 typed, 1 live → 8); a box
  emptied → not counted; a box that was not counted → what was typed.
- When a number moved while the form was open, the brand is told after saving.
- A client that sends no "shown" numbers is saved as before.

### C · Place order happens once
- The phone sends one key with each order attempt and the same key when it retries that attempt.
  The server answers a repeated key with the order it already made, and makes nothing new.
- A different address, payment method or basket is a new attempt with a new key.

### D · A set is in the shop only while it can be bought
- A set's post is in the shop only while every piece is on sale and has stock for its quantity. It
  returns by itself. A set whose pieces may be bought alone keeps its post while any piece sells.
- On the phone, choosing a piece that the set needs ×2 puts both in, in the colour and size chosen.

### Explicitly out of scope
- Items 5–12 and the lower-priority list of the audit.
- Bringing back posts that were removed before this change.
- A separate colour and size for each of the ×2 pieces of a set.
- The older flat product page and its Excel upload.
- Shopper wording for a post that is paused ("This post is no longer available" stays).

## Surfaces touched
- backend · brand-web (Listings, Edit product) · mobile (follower: checkout, deal page; influencer:
  the post page) · the rulebook `Docs/OFFER_TERMS_POSTS_RULES.md` (2.8, 4.9 → v1.22)

## Data / contracts
- Migration **207** (additive): `checkouts.client_key text`, unique per shopper where set.
- `PATCH /brands/me/listing-products/:id`: each size may carry `stock_was`; the answer may carry
  `stock_notes`.
- `DELETE /brands/me/products/:pid`: may answer 422 `REMOVE_REFUSED`.
- `GET /brands/me/offers/product-offers/:productId`: `posts` is real; `+ posts_only_this`.
- `POST /follower/checkout/place`: `+ place_key` (optional).
- Creator's single post read: `+ not_in_shop` (a sentence, or null).
- Money: none moved. No order, wallet or commission rule changes.

## Non-functional
- An app or page that has not updated keeps working: every new field is optional.
- Failure modes: a repeated Place order whose first try has expired or failed starts afresh; a
  Remove that is refused changes nothing.
