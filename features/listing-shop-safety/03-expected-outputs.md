# Expected Outputs — Listing and shop safety: four fixes

> Step numbers are those of `02-workflow.md`. "Compiles" is NOT an expected output.

## A · Pause (`backend/tests/listing-shop-safety.test.js`)
| # | Step | Observable output | How it is verified |
|---|---|---|---|
| 1 | 1 | Hide: `post_products` still holds the row; the post is `approved`; the feed does not list it; `GET /follower/posts/:id` answers not found | real API, real database |
| 2 | 2 | A notice "{product} is not on sale right now" for the creator; her post read carries `not_in_shop` | notifications table; creator's post read |
| 3 | 3 | Show: the feed lists the post again with the product; notice "{product} is back on sale"; `not_in_shop` is null | same |
| 4 | 4 | One of three hidden: the post is listed with two products; `top_price` and categories come from the two | card + the post row |
| 5 | 5 | Every size 0 saved: post `approved`, not listed; stock raised → listed | same |
| 6 | 6 | Panel: `posts` = the count of that product's live posts, `posts_only_this` = those with nothing else | `GET /brands/me/offers/product-offers/:id` |
| 7 | 7 | Remove: rows gone from posts; the one-product post `removed`, reason `unavailable`, its creator told | database + notifications |
| 8 | 8 | Remove of a set's piece: 422 `REMOVE_REFUSED` with the sentence; the product is still on sale and in its posts | API + database |

## B · Edit (`listing-shop-safety.test.js`)
| # | Step | Observable output | How it is verified |
|---|---|---|---|
| 9 | 9 | shown 3, sold 2, sent 3 with `stock_was` 3 → saved 1; own stock follows; `stock_notes` names the size, shown 3, now 1 | API |
| 10 | 10 | shown 3, sold 2, sent 10 → saved 8; note says 8 | API |
| 11 | 11 | emptied → null; was null, typed 5 → 5; a size that is new → what was typed | API |
| 12 | 12 | nothing moved → exactly as typed, `stock_notes` empty | API |
| 13 | — | no `stock_was` at all → saved as sent (the old behaviour) | API |

## C · Place order once (`listing-shop-safety.test.js`)
| # | Step | Observable output | How it is verified |
|---|---|---|---|
| 14 | 13 | COD, the same `place_key` twice → one checkout, one set of order lines, stock taken once; both answers carry the same `checkout_id` and `status: placed` | API + database |
| 15 | 14 | Online, the same key twice → one pending checkout, stock held once; the second answer carries the same Razorpay order | API + database |
| 16 | 15 | a different key → a second checkout | API |
| 17 | 16 | the first attempt abandoned, the same key again → a new checkout; the old one keeps no key | API + database |
| 18 | — | no key → as today | the existing ordering suites stay green |

## D · Sets (`listing-shop-safety.test.js`)
| # | Step | Observable output | How it is verified |
|---|---|---|---|
| 19 | 17–18 | a set's post leaves the feed when a piece is hidden or at 0, and returns when it is back | API |
| 20 | 19 | with pieces alone allowed, the post stays | API |
| 21 | 20 | a piece with quantity 2 and stock 1 → the post is not listed; stock 2 → listed | API |

## Website (`Packages/brand-web`, looked at in a local preview)
| # | Observable output |
|---|---|
| 22 | The panel line shows the true post count |
| 23 | Remove asks with the numbers; a refused Remove shows the sentence and changes nothing |
| 24 | Edit: after a save where stock moved meanwhile, the message is shown before returning to Listings |

## Phones (`Packages/Mobile`, jest)
| # | Observable output | Where |
|---|---|---|
| 25 | Place order sends `place_key`; a second tap after a lost answer sends the same key; a new review makes a new one | `CheckoutScreen` |
| 26 | Choosing a ×2 piece of a set makes a line of 2 | `DealScreen` |
| 27 | A live post that is not in the shop shows "Not in the shop right now" and the server's sentence; other posts show nothing new | `PostStatusScreen` (creator) |

## Regression gates
- `backend`: the full suite, serial, against `backend/baseline_stock_asked_once.json` — 0 newly failing.
- `Packages/Mobile`: the whole jest suite, all passing (123 suites / 2,922 tests today).
- Tests pinned to the old behaviour (a hidden product leaving posts; a zero-stock save removing a
  post) are assertion drift from an approved rule change: each is named and updated, none loosened.

## Live data, at release
- Migration 207 applied BEFORE the push (the new server writes the column).
- Read before and after, identical: posts, post products, order lines, checkouts, wallets.
