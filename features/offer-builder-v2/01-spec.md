# offer-builder-v2 — spec (Level 1: how a brand builds an offer)

Rules of record: `Docs/OFFER_TERMS_POSTS_RULES.md` **v1.4, §0 and §1** (§2 for the parts Level 2 will
read). Locked screens: `04-preview/mockups/offer-builder-v2-mockups-v1.html`, web boards **O1–O13**
(locked 28 Sep 2026; the phone pool builder P1–P4 is NOT locked and is not built here). Survey facts:
`Docs/OFFER_TERMS_BUILD_HANDOFF.md`. Build order: this, then `features/creator-terms-v2` (Level 2).

## What Level 1 delivers

On the brand website, in **Listings**, a brand builds offers on **product pools** in six steps
(type → sub-type → name & dates → products → numbers → review & publish). Publishing **locks** the
pool's products to that offer for its dates: one product, one offer at a time (P2). Four places in
Listings: **Offers** (O1), **Products without offers** (O8), the **Offer** column and panel on
Products (O9), **Gift items** (O13). A live offer can only lose products or end early (O10, O11). A
price change on a product that is in an offer warns first and tells the creators after (O12).

## Decisions taken in building (founder delegated; recorded here, surfaced in the build summary)

| # | Decision | Why |
|---|---|---|
| D1 | Same `brand_offers` table, `engine = 2` for the new builder. Every existing offer is **archived** and taken off the store by migration 193 (rules 1.13, clean break; production offers are test data). | One table keeps the old copies on collaborations readable by id. |
| D2 | Stored statuses: `draft` → `published` → (`ended` only when ended early). **Scheduled / Live / Ended are worked out from the two dates in India time** every time they're read. | A date passing needs no job to be right. |
| D3 | Dates are two calendar days, both included: an offer "1 Oct – 31 Oct" is live all of 31 Oct. | Matches how the screens read. |
| D4 | The lock lives in the **database**: two exclusion constraints refuse any product or gift item in two published pools whose days overlap. The app checks first to name the product; the constraint is the backstop for two people at the same brand publishing in the same second. | Discipline → machine (P2 is a principle, not a hope). |
| D5 | The pool has two layers. **Sources** (how it was built: category all / tick / filters, search, "put in offer", gift items) are the recipe while drafting, resolved live. At publish the pool is **frozen** into item rows that carry the locked days. | Drafts lock nothing (1.5); duplicates and locked products are worked out, not stored. |
| D6 | At publish the brand's screen sends the products it showed on the review step. If any of them is now locked, or the pool changed, publishing is blocked and the product is named (1.5 "final lock check"). | The brand publishes exactly the pool they reviewed. |
| D7 | "End offer now": the offer is `ended` today and its products are **free from today**. Ending a Scheduled offer frees them entirely. | 1.10 "freed immediately". |
| D8 | "Remove products" is refused when it would break the deal: every buy product removed ("end the offer instead"), a fixed bundle's products, a pick-any / mix & match pool dropping below the pick count, or a gift pool left empty. | The creators' posts promise that deal. |
| D9 | "Auto-add new products" (off by default) works on *category → all* and *category → filters* sources in the buy pool. A product listed later joins a published offer's pool **from that day**, unless locked or excluded. Drafts see new products naturally. | 1.4. |
| D10 | Offers linked to collaborations: a `collab_offers` table is created now, **empty**; Level 2 writes it. Level 1 reads it for "creators given this offer" and to tell creators when an offer ends, loses products, or a product's price changes. | The notices are Level 1 rules (1.10, 1.11); the links are Level 2's. |
| D11 | **Posts and sales don't exist yet** (Level 3). Where the locked screens show posts or sales, the page shows 0 / "—" and says posts come with shoppable posts. Nothing is invented. | Backend-first tiles. |
| D12 | Checkout does **not** apply the new offers yet. Every purchase goes through a creator's post (P1); applying an offer at checkout comes with posts (Level 3, rules §3). The old checkout offer code finds no live old offers after D1. | No shopper screens exist to buy through. |
| D13 | Retired **from the screens** in this level: "Publish to store", the "In store" badge, "Pay at store / Online / Pre-book", the old pop-up builder, the bulk "Attach offer" action (and its endpoint). The store-direct payment path, `promoted_brand_offer_ids` and the special offer are retired by later cuts (outside-in, one cut per commit; the special offer goes with Level 2). | Handoff "retire outside-in". |
| D14 | The old phone terms sheet keeps asking for offers the old way and now gets none (all archived). New offers are only listed when the website asks for the new builder's list, and the old "attach a saved offer" path refuses them. Level 2 replaces that sheet. | A new offer must never be **copied** onto a collaboration (2.3). |
| D15 | One more publish check: **the end date hasn't already passed.** | An offer that is over the moment it's published would lock nothing and help no one. |
| D16 | "Published product" = listed and shown in the store (`is_active` and `pushed_to_store`). Only those appear in pools, "products without offers" and auto-add. | Same meaning allocation already uses. |

## The six steps (O2–O7)

1. **Type** — Discount · BOGO · Volume · Bundle · Free gift. Choosing a type and pressing Next saves a
   draft ("Draft saved automatically"). From then on every change saves.
2. **Sub-type** — Discount: Percentage / Flat · Volume: By quantity / By value · Bundle: Pick-any /
   Mix & match / Fixed · Free gift: Spend threshold / Buy X get Y. **BOGO skips this step.**
3. **Name and dates** — both dates required, end after start. The note explains that the dates decide
   which products are locked.
4. **Products** — the pool builder (O5, O5b):
   - *Browse by category* (any level of the tree) → **All N products** / **Tick specific products** /
     **Use filters** (sub-category, brand, price range; kinds combine with AND, values within a kind
     with OR). *Search products* (name or SKU) → tick. Each addition is one line in the pool; lines
     add together (OR); duplicates are counted once; locked products are shown with the other offer's
     name and end date and can't be added. "See all N products" lists the pool; a product can be
     taken out of it there. A product includes all its sizes and colours.
   - *Auto-add new products* switch on category-all / filter lines (off by default).
   - **Free gift:** two pools, buy and gift. The gift pool takes store products (tick / search) and
     **gift items** (its own tab, plus "+ New gift item"). A store product used as a gift needs a gift
     stock limit.
   - **Fixed bundle:** products by search, each with a quantity; the total price of the items is shown.
   - **Pick-any bundle:** products from **one** category; adding a second category is refused with the
     locked board's wording (use Mix & match instead).
5. **Numbers** — one panel per sub-type, checked as the brand types (O6):
   Discount % (percent, optional max ₹ per item, an example "₹2,299 → shopper pays ₹1,899") ·
   Flat (₹ off each item) · BOGO (optional max free items per order) · Volume (reward % or ₹, 1–4 tiers,
   each higher than the last) · Pick-any / Mix & match (pick count, price, **suggested safe price**) ·
   Fixed (bundle price vs total) · Free gift (minimum spend or buy quantity, number of gifts).
6. **Review and publish** — the summary, every publish check with a tick or a cross; Publish stays off
   until all pass; Save as draft locks nothing.

## Publish checks (rules 1.8, plus D15)

| Check | Applies to |
|---|---|
| End date after start date · end date not passed | All |
| No product (buy or gift) in another published offer on overlapping dates | All |
| The pool has products (a gift pool has gifts) | All |
| Tiers: threshold and reward both increase; 1–4 tiers; a ₹ reward below its threshold | Volume |
| Costliest ≤ 1.5 × cheapest · the cheapest combination saves ≥ 10% · pool ≥ pick count | Pick-any, Mix & match |
| All products from one category | Pick-any |
| Bundle price below the total price of its items | Fixed |
| ₹ off below the cheapest item in the pool | Flat |
| Costliest gift combination below the minimum qualifying purchase · buy and gift pools share nothing · every gift has a stock limit (a gift item has stock) · number of gifts ≤ gifts in the pool | Free gift |
| No price checks | BOGO |
| Margin floor — not checked (deferred, O6) | — |

"Minimum qualifying purchase": the minimum spend (Spend threshold); buy quantity × the cheapest buy
product (Buy X get Y). "Suggested safe price" for pick-any / mix & match: from 80% to 90% of the
cheapest combination, rounded down to ₹100 (the board's ₹2,700 – ₹3,100 for a ₹3,448 pair).

## After publishing (O10, O11, O12)

- Name, type, numbers, dates and pool additions **can't be changed**. A draft can be deleted; a
  published offer can't, only ended.
- **Remove products** (D8): they leave the pool at once and are free; every creator given the offer is
  told which products left. Posts: none exist yet (D11).
- **End offer now** (D7): the offer ends today, all products are free, every creator given it is told.
- **Price change** on a product that is in a live or scheduled offer: before saving, the brand sees the
  offer, how many creators have it, what a shopper would pay, and any rule the new price breaks
  (bundle band, bundle saving, flat ₹ off, fixed total, free-gift threshold). Nothing is blocked. After
  saving, each creator given that offer is told the old and new price.

## Listings (O1, O8, O9, O13)

- **Offers (O1):** search, type chips, status chips with counts (Live, Scheduled, Draft, Ended), a date
  filter ("valid on"), columns Offer / Type / Products / Dates / Status / Creators / Open-or-Continue.
- **Products without offers (O8):** every published product not in any offer on the chosen date
  (default today), with its next scheduled offer, or the offer it was last in and when that ended.
  Search, category and price filters. Tick products → **Put in offer** starts a new offer with them
  already in its pool.
- **Products (O9):** an Offer column (the offer now, until when; or the next, from when; or "No
  offer") and, on a product, a panel with the offer now (dates, creators given it, posts) and the
  next offer ("None. Free from 1 Nov.").
- **Gift items (O13):** list with value, stock and the offer it's used in; "+ New gift item" (name,
  photo, value, stock); restock by editing stock. Gift items never appear anywhere else.

## Out of scope (later levels)

The phone offer builder (P1–P4, not locked) · linking offers to creators (Level 2) · posts, price
bands, removing posts from the shop (Level 3) · applying offers at checkout, stock counting and gift
stock counting (rules M7, with checkout) · margin floor (deferred).
