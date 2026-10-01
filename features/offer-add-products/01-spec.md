# offer-add-products — spec

**A published offer's products can be added to or removed only while no creator has the offer.**
A follow-up to `features/offer-builder-v2` (Level 1). Rules: `Docs/OFFER_TERMS_POSTS_RULES.md`
**v1.14** §1.10, §1.12, §2.8. Website only (the offer page, Listings → Offers → an offer). No
phone screen, no migration.

## The founder's instruction (chat, 1 Oct 2026, with a screenshot of the offer page)
> "when we open the created offer we are getting two options that is remove products and end
> offer… we need another option to add products into offer also… if offer not allocated to any
> creator then we can add and remove products… if allocated to any creator then both options should
> be disabled and show the text that this offer is allocated to some one so we dont allow for
> modifying products."

## State before (verified 1 Oct 2026)
- The offer page showed **Remove products** and **End offer now** on a Scheduled or Live offer.
- Nothing could be added after publishing (rules 1.10: "pool additions can't be changed").
- Remove products worked **even when creators had the offer**: the products left their posts, a post
  left empty was removed, and each creator was told (rules 1.10, 2.8).

## The rule now
| The offer is… | Add products | Remove products | End offer now |
|---|---|---|---|
| Scheduled or Live, **given to no creator** | ✅ | ✅ | ✅ |
| Scheduled or Live, **given to one or more creators** | ❌ disabled | ❌ disabled | ✅ |
| Ended / Draft | not shown | not shown | not shown |

When it's disabled the page says why: *"This offer has been given to N creator(s), so its products
can't be added or removed. Creators' terms and posts promise these products. To change the deal, end
the offer and build a new one."*

## Decisions (delegated under standing autonomy; each follows an existing rule)
| # | Decision | Why |
|---|---|---|
| A1 | **"Given to a creator"** = the same count the page already shows as "Creators given this offer": an invitation or collaboration that carries the offer and is not declined, expired or withdrawn, and from which the offer has not been dropped. **An unsigned invitation counts.** | Her invitation already lists these products; one number on the screen decides the buttons. |
| A2 | The rule is enforced **on the server** for both add and remove (409 `OFFER_GIVEN`), not only by disabling buttons. | A page left open, or another tab, must not get round it. |
| A3 | Added products are **held from today** (from the start date for a Scheduled offer) **to the offer's end date**, under the same lock as publishing. A product another offer holds on any of those days is refused and named. | Rules 1.5. A product whose other offer ended earlier is free from today, so the picker shows it unlocked. |
| A4 | The pool with the new products must still pass the **publish checks** (rules 1.8): bundle price band and saving, pick-any one category, flat ₹ off below the cheapest, volume tier ₹ off, free-gift threshold. The refusal says which, in plain words. A check the pool already failed because a price changed since publishing (rules 1.11) is not held against the new products. | The deal's numbers are frozen; the products must fit them. |
| A5 | **A fixed bundle** takes no products (it is exactly its products; the same reason removal is refused, D8). Its page shows no "Add products". | D8 of offer-builder-v2. |
| A6 | **Gifts can't be added** this way; only products the shopper buys. | A gift needs a stock limit and the gift checks; out of scope for a one-button fix. |
| A7 | **No migration.** An added item keeps `added_by = 'publish'` (= added by the brand); its pool line (`offer_pool_sources`, method `picked`) and `added_at` say when. The page shows "added 3 Oct 2026" when a product joined after the start date. | The column's CHECK allows only `publish` / `auto_add`; widening it needs a production migration this fix doesn't warrant. |
| A8 | **Auto-add is unchanged** (rules 1.4): a brand that switched it on before publishing still gets new matching products, even after creators have the offer. | It was chosen at building and is its own rule; creators can use the new products in new posts only. |
| A9 | **End offer now is unchanged**, including its warning about unsigned invitations. | Founder named only add and remove. |
| A10 | The removal engine under the brand's button (products leave posts, an empty post is removed, creators told) **stays in the code as a backstop**. It can no longer be reached from the page. | If an invitation is sent in the same instant as a removal, posts and creators are still handled. |

## What the brand loses
With a creator on the offer, a single product can no longer be taken out of it. The brand's ways out:
end the offer (every post using it leaves the shop), or take the product off sale in Listings (it
leaves her posts under the existing "product becomes unavailable" rule, 2.8).

## Not in this change
Adding gifts; adding to a fixed bundle; changing dates, numbers or name; the phone.
