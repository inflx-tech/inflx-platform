# shopper-app-fixes — impact

**Verdict.** Production-impacting, small: a server release and an update of the shopper app. No migration, no new app build, no rule change, no money moves. One thing about money changes for the better: a cancelled online payment no longer empties the bag or holds the items for 15 minutes.

## 1 · Who notices what
| Who | Changes |
|---|---|
| Shopper | The fifteen faults and eight small ones of `01-spec.md` are gone. New on screen: a Back arrow on a video opened from a store or search; "Your name" once at first sign-in; Profile rows Following and Notifications that open plain lists; "Remove" on a saved product; "Resend code". |
| Creator | A shopper's comment reads her real name, or "INFLX shopper" (was "Follower"). Nothing else. |
| Brand | A product sold out in every size now reads out of stock to shoppers, and its stock number on the listing follows its sizes after each sale. |
| INFLX admin | Nothing. |

## 2 · Server
| Change | Risk |
|---|---|
| Online order: the bag is emptied when the payment arrives, not at Place order | A checkout made before the release and paid after it has no remembered bag lines — its bag was already emptied at Place order, so nothing is left behind |
| New `POST /follower/checkout/:id/abandon` (her own pending checkout only) | A payment that still arrives afterwards takes the items again or is refunded — the path that already existed for a hold that ran out |
| A sized product's own stock number is set to the sum of its sizes when stock moves | A listing whose own number disagreed with its sizes is corrected at its next sale or cancel; only when every size has a count |
| `in_stock` on a post card follows the sizes | A product sold out in every size stops being addable (it could not be bought anyway) |
| Per-size `shopper_price`; `name_needed`; `saved` in a collection; `screen` in a shopper's notification; a shopper-facing title for a post with no caption | Additive fields; older app versions ignore them |
| Profile's Orders line counts every order not yet delivered | Wording only |

## 3 · Phone (shopper app only)
Shared file touched: `services/api.js` — the session is renewed before a request when it has run out. The brand and creator apps use the same file; they are not published in this round and their behaviour on a refused request is unchanged.

## 4 · What can go wrong, and the undo
- The session renewal (F3) is the one change every screen passes through. If it misbehaves: publish the previous shopper bundle again (the server needs no undo for it).
- Everything else is local to one screen. Undo: revert the commit and push; publish the previous shopper bundle.

## 5 · Not covered
- Nothing here has been seen on a phone: the device walk is owed, as for the 4 Oct release.
- The design round (My orders by deal, replacing one item, buying one item alone) is separate.
