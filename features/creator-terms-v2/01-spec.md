# creator-terms-v2 — spec (Level 2: what a creator can sell)

Rules of record: `Docs/OFFER_TERMS_POSTS_RULES.md` **v1.4, §2** (with §1 for the offers it reads).
Locked screens: `04-preview/mockups/creator-terms-v2-mockups-v1.html` — brand app **T1–T7**, creator
app **C1–C5** (locked 28 Sep 2026). Depends on `features/offer-builder-v2` (Level 1, live).

## What Level 2 delivers

When a brand sets a creator's terms for a Pay for Sale or Hybrid set, **what she can sell** is now:

1. **Offers** — any of the brand's published offers that run on the set's posting date. They are
   **linked** to her collaboration, never copied, so an offer ending reaches her.
2. **Products without offers** — none, all of them, or chosen ones. The list is **frozen when the
   invitation is sent** (founder Q2).

The old "whole store / a category / chosen products" scope and the copied or special follower offer
are not used for these collaborations. The follower offer code is not created (rules 2.10).

The creator sees her offers read-only, with what she earns on each (founder Q3), the products at
normal price, and notices when something she can sell changes.

## The three board questions (founder, 28 Sep: "stand as recommended")

| Q | Decision |
|---|---|
| Q1 | Ending an offer takes it out of every **unsigned** invitation holding it and tells the creator. An invitation left with nothing to sell is **withdrawn automatically**. The brand is warned before ending ("It's in 3 unsigned invitations"). |
| Q2 | "All products without offers" means the list **on the day of sending**. Products listed later don't join. |
| Q3 | Each offer shows an example of what she earns: "10% of ₹2,999 = ₹300". |

## Decisions taken in building (founder delegated; recorded here, surfaced in the build summary)

| # | Decision | Why |
|---|---|---|
| D1 | A collaboration carries `sell_v2 = true` when its terms are the new kind. **No backfill**: every existing collaboration keeps its old terms and is read exactly as before. The database refuses a new-kind row that also carries the old scope or a copied offer. | Clean, additive; old collaborations are untouched. |
| D2 | Offers are linked through `collab_offers` (created empty by migration 193). A link is never deleted; when an offer leaves an unsigned invitation the link is stamped `dropped_at` + `dropped_reason`. | 2.3 "linked, not copied"; the history stays readable. |
| D3 | An offer can be given for a set when it is **published and running on the posting date** (it may start the day after, the join window of 2.1). Others are listed as left out, with the reason and date. | 2.1, 2.3; board T2. |
| D4 | "Ends soon" = the offer ends less than 7 days after the posting date. It's a warning on the terms and the Review screen (T7), never a block. | Board T7. |
| D5 | "Products without offers" = the brand's published products **not held by any published offer on or after the posting date**. A product whose offer ended before that date is free again. | 2.4. |
| D6 | The new terms are required only when an **invitation is sent**. Counters and pitches change money only; what she can sell stays as sent (2.6). An old phone app that still sends the old scope is refused with: "What a creator can sell has changed. Update the app, then set her terms again." | Old apps can't write the old shape onto a new collaboration. |
| D7 | Sending refuses: nothing to sell ("Give Priya at least one offer or one product without an offer."), an offer not running on the day, another brand's offer, a product that sits in an offer, a product that isn't the brand's. | 2.3, 2.4, 2.5. |
| D8 | Ending an offer early (Q1): dropped from invitations not yet signed (invited, applied, accepted, negotiating, with no signed agreement); she's told; an invitation left with nothing to sell is withdrawn (not yet answered) or closed (answered, and an unsigned agreement is withdrawn). An agreement sent but not signed has its "You can sell" part refreshed. **Signed collaborations keep the link**; the offer shows as ended there. An offer that had already ended doesn't count as something left to sell (found in the walk, 06-diff). | 2.8. |
| D9 | A product she can sell (through a linked offer, or at normal price) going **off sale, out of stock, or to a new normal price** sends her a notice. | 2.8, 2.11. |
| D10 | The creator's example earning is her commission % of one example purchase: a discount → the dearest item after the discount; BOGO → the dearest item; a bundle → the bundle price; volume → the first tier bought at the cheapest item; spend → the minimum spend. Rounded to the rupee. | Q3; one line she can check by hand. |
| D11 | A **Notifications** screen is added to the creator app (bell on Collabs), because the profile-only app had nowhere to read the C5 notices. A notice opens "What you can sell" or the invitation it's about. | C5 needs a place to live. |
| D12 | A store-visit or remote shoot's products are the products she can sell (her offers' pools + her normal-price list). | Same list everywhere. |
| D13 | The publish check reads linked offers instead of the old shopper offer; the "owed items" reader ignores new-kind rows (they own no old scope). | The old readers accept the new terms. |
| D14 | **Not in Level 2:** shoppers buying through these collaborations (the old storefront and checkout don't sell new-kind rows; posts come in Level 3), the website's old invite path (unchanged; it can't carry new offers, Level 1 D14), and building offers on the phone (rules O7). | Levels 3+. |

## Screens

Brand app: T1 terms card with the "You can sell" rows · T2 offers sheet (valid, ends soon, left out) ·
T3 products-without-offers sheet (none / all / chosen) · T4 choose products (categories, search, price) ·
T5 summary line · T6 no valid offer (points to the website) · T7 Review and send (Ends soon).
Website: the End offer dialog warns about unsigned invitations (Q1).
Creator app: C1 invitation "You can sell" row · C2 What you can sell · C3 One offer · C4 the
agreement's offers and the end rule · C5 notices.
