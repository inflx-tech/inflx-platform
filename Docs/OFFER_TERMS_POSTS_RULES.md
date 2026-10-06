# INFLX business rules — Offers, Creator terms, Shoppable posts

**Version 1.21 · 5 October 2026 · living document**

This is the design of record for three linked parts of INFLX:

1. how a brand builds **offers** on its products,
2. how a brand gives those offers (and other products) to a creator in **collaboration terms**,
3. how a creator turns them into **shoppable posts**, and how a sale is credited.

Every rule here was agreed with the founder in chat on 28 September 2026, from three founder
documents plus two rounds of questions. Where a rule is still open, it says **OPEN** and who
owes the answer. Update this file whenever a rule changes and add a line to the change log at
the bottom. It supersedes `Docs/OFFER_POSTS_PROGRAMME_DECISIONS.md` (kept as the raw decision log)
and, for these three areas, the older offer-engine and post-concept designs.

Locked screens: `features/offer-builder-v2/04-preview/mockups/` (offer creation, web).

---

## 0. The principles everything else follows

| # | Principle |
|---|---|
| P1 | **Every purchase happens through a creator's post.** Shoppers don't buy loose products from a brand store; the brand store itself is made of creators' posts. |
| P2 | **One product, one offer at a time.** A product can be in only one live offer for any given date. |
| P3 | **Offers are for creators only.** An offer reaches shoppers only through the posts of creators who were given it. |
| P4 | **A post must never sell below its promise.** If a post's photos or video promise an offer, it can't keep selling at full price when that offer is gone. |
| P5 | **A sale belongs to the post it came through.** The creator who made the post is credited, with no time limit. |
| P6 | **One post = one brand, one collaboration, one offer (or none).** No mixing. |

---

## 1. Offers

### 1.1 Where offers are built
- On the **brand website**, in Listings → Offers. The phone version comes later, with the same six steps.
- Only the brand builds offers. Offers can't be created inside creator terms (the old "special offer" is removed).

### 1.2 The six steps (same for every offer)
1. Offer type
2. Sub-type (skipped for BOGO, which has only one kind)
3. Name and dates
4. Product pool(s)
5. The numbers
6. Review and publish

Dates come before products because locking depends on dates.

### 1.3 Dates
- Start date and end date are **both required**. The end must be after the start.
- The offer is live only between those dates.

### 1.4 The product pool
A pool is a list of products. The brand builds it with any mix of four methods:

| Method | Example |
|---|---|
| Category → all products | Jeans → all 50 |
| Category → tick specific products | Jeans → tick 12 |
| Category → filters (sub-category, brand, price range) | Jeans, Slim + Levi's + ₹1,500–₹2,500 |
| Search individual products (name or SKU) | "Levi's 511", "Cotton shirt" |

- Filters inside one category combine with **AND**: Slim *and* Levi's *and* ₹1,500–₹2,500.
- Different methods add together (**OR**): filtered jeans + 2 shirts found by search.
- Duplicates are removed automatically.
- A product includes **all its sizes and colours**.
- The price filter uses the product's price. MRP was retired in July 2026; a product has one price.
- **Locked products** (in another published offer with overlapping dates) are shown with the other
  offer's name and end date, and can't be added.
- The pool is **frozen once the offer is given to a creator**. Between publishing and that moment
  the brand can still add or remove products (1.10).
- Optional **"Auto-add new products"**, off by default. It works only for *Category → all* and
  *Category → filters* sources. New products that match join the pool unless they're locked. Creators
  can pick them for **new** posts; existing posts don't change.
- There are **no whole-store offers**.

### 1.5 Locking
- Products lock only when the offer is **published** (Scheduled or Live). **Drafts lock nothing.**
- A final lock check runs at the moment of publishing. If another offer took a product in the
  meantime, publishing is blocked and the product is named.
- In a free gift offer, **both the buy pool and the gift pool are locked**. Gift items (1.7) follow the
  same rule.
- A product removed from a live offer is **freed immediately**.

### 1.6 The offer types

| Type | Sub-type | Pool | Numbers | Example |
|---|---|---|---|---|
| **Discount** | Percentage | 1 | Discount %, optional max ₹ off per item | Levi's jeans 20% off (max ₹400) |
| | Flat | 1 | ₹ off per item (less than the cheapest item in the pool) | Men's shirts ₹200 off |
| **BOGO** | — | 1 | Optional max free items per order | Pool: Levi's 511, 501, 505 |
| **Volume** | By quantity | 1 | Reward type (% or ₹), 1–4 tiers: Buy [qty] → [reward] | T-shirts: Buy 2 → 20%, Buy 3 → 30% |
| | By value | 1 | Reward type (% or ₹), 1–4 tiers: Spend ₹[amount] → [reward] | Men's wear: Spend ₹2,000 → 10%, ₹3,000 → 20% |
| **Bundle** | Pick-any | 1, from **one** category | Pick count, bundle price | 15 jeans → any 2 for ₹2,999 |
| | Mix & match | 1, from several categories | Pick count, bundle price | Shirts + trousers + jeans → any 3 for ₹3,499 |
| | Fixed | Exact products, a quantity each | Bundle price (system shows the total price) | Shirt + trouser + belt ₹2,499 (total ₹3,197) |
| **Free gift** | Spend threshold | Buy pool + gift pool | Minimum spend ₹, number of gifts | Spend ₹3,000 on jackets → 1 free gift from {cap, belt, coin} |
| | Buy X get Y | Buy pool + gift pool | Buy quantity, number of gifts | Buy any 2 Pattu sarees → 1 free from {blouse piece, silver coin} |

How each works for the shopper:
- **BOGO:** buy any one product from the pool and get **the same product** free in any size or colour,
  whatever that variant costs. Buy 511 Blue 32 → 511 Black 34 free ✅. Buy 511 → 501 free ❌.
- **Volume:** every pool product counts toward the quantity or spend. Tiers **replace** each other and
  never add up.
- **Bundle pick-any / mix & match:** the system checks the price band and suggests a safe price range.
- **Fixed bundle:** the shopper only chooses size and colour.
- **Free gift:** one item in the gift pool → the shopper gets it. Several → the shopper chooses.
  1 buy product + 1 gift works as "buy this jacket, get this cap".

### 1.7 Gifts: store products and gift items
There are two kinds of gift:

| | Store product used as a gift | Gift item |
|---|---|---|
| Example | A leather cap the brand also sells | A silver coin, water bottle or tote the brand never sells |
| Where it's listed | Listings → Products, the normal way | **Listings → Gift items** (its own tab) |
| Fields | Everything a product has | **Name, photo, value (₹), stock**. No category, sizes or price |
| Sold? | Yes, normally. But **while it's in a live gift pool no creator can sell it**: it's locked to that offer as a gift. It sells normally again after the offer ends. | **Never.** Not in the shop, not in buy pools, not in "products without offers", not in creator terms |
| Stock | The offer sets a **gift limit**. Each gift also reduces the product's stock. | Its own stock. Each gift takes one. Restocked in the Gift items tab. |

- In the gift pool, the brand picks store products (Browse/Search) and gift items (Gift items tab) from one place.
- A **"+ New gift item"** shortcut in the gift pool opens the same 4-field form and saves the item to the Gift items tab.
- A gift stock limit is **required** for every gift.
- The gift item's value is shown to shoppers ("worth ₹650") and used in the gift check (1.8).

### 1.8 Checks at publish

| Check | Applies to |
|---|---|
| End date after start date | All |
| No product in another published offer on overlapping dates (buy and gift pools both) | All |
| Tiers: quantity or spend increases, reward increases; 1–4 tiers | Volume |
| Costliest item ≤ 1.5 × cheapest; cheapest combination saves ≥ 10% | Bundle pick-any, mix & match |
| Pool has at least the pick count | Bundle pick-any, mix & match |
| Bundle price < total price of its items | Bundle fixed |
| ₹ off < cheapest item in the pool | Discount flat |
| Costliest gift combination < minimum qualifying purchase | Free gift |
| Buy pool and gift pool share no product | Free gift |
| Every gift has a stock limit | Free gift |
| No price checks | BOGO |
| **Margin floor: not checked.** Deferred; discuss later. | — |

### 1.9 Status and deleting (changed 3 Oct, v1.17)
- **Draft** (not published, locks nothing) → **Scheduled** (published, start date not reached) →
  **Live** → **Ended** (ended early with **End offer now**, or ended by its end date).

1. A **Draft** can be deleted from the Offers list. It is **erased**: a draft was never given,
   posted or sold.
2. An **Ended** offer — ended early with End offer now, or ended by its date — can be deleted, from
   the Offers list and from its own page. It is **removed from the brand's lists**; its record stays
   for the creators who had it, their posts, orders, payments and INFLX.
   - "Removed from the brand's lists" means: it leaves the Offers list and its counts, its page
     answers "not found", and it is left out of the brand's other offer hints (the "not shown,
     ended" note when giving offers in creator terms; "last in offer …" on Products without offers).
     The days its products were held are freed, so a new offer whose start is back-dated over them
     is never refused naming it.
   - Nothing a creator, shopper, order, the wallet or INFLX admin reads changes: she still sees it,
     as Ended, in her terms and on her posts, with its earnings; orders and sales still name it.
   - An ended offer no creator ever had is hidden the same way, not erased. There is no undo.
3. A **Scheduled** or **Live** offer can't be deleted. **End it first.**
4. Editing is unchanged: drafts through Continue; a published offer's name, type, numbers and dates
   stay frozen (1.10).

### 1.10 Changing a published offer (changed 1 Oct, v1.14)
Name, type, numbers and dates can't be changed once published. What can change depends on whether
the offer has been **given to a creator** (it is in an invitation or a collaboration that is not
declined, expired or withdrawn; an unsigned invitation counts):

| Change | Given to no creator | Given to one or more creators |
|---|---|---|
| **Add products** | ✅ Held from today (from the start date if the offer is Scheduled) to the end date. A product another offer holds on those days can't be added. The pool with the new products must still pass the checks at publish (1.8). Gifts and a fixed bundle's products can't be added. | ❌ |
| **Remove products** | ✅ Freed immediately. Refused when it would break the deal (the last product, a fixed bundle's products, a pool below the pick count, the last gift). | ❌ |
| **End offer now** | ✅ All products are freed. | ✅ Every post using the offer is **removed from the shop**, creators are notified, and all products are freed. |

Once a creator has the offer, the offer page shows Add products and Remove products greyed out with
the reason: *"This offer has been given to 2 creators, so its products can't be added or removed."*
Her terms and posts promise these products. To change the deal, end the offer and build a new one.
To stop selling one product, take it off sale in Listings (2.8). **Shoppers who have already started
paying keep the old price.**

Auto-add (1.4) is separate: it was chosen while building and keeps working after creators have the
offer.

### 1.11 A product's price changes while it's live
1. Before saving, the brand sees a warning: which offer and posts the product is in, what the shopper
   will now pay, which price band the posts move to, and any bundle rule the new price breaks.
2. Nothing is blocked. The brand confirms or cancels.
3. After saving, each affected creator is told the old and new price.
4. Posts' price bands recalculate automatically (4.6).
5. Shoppers who have already started paying keep the old price.

### 1.12 Brand screens for offers (website, Listings)
- **Offers:** list with search, filters (type, status, dates), products count, creators count. A Draft
  row has **Continue** and **Delete**; an Ended row has **Open** and **Delete**; a Scheduled or Live
  row has only **Open** (1.9).
- **Products without offers:** every published product not in any offer on a chosen date, with its next offer if one is scheduled.
- **Products:** an **Offer** column and a product panel showing the current offer (until when) and next offer.
- **Gift items:** the gift-only list (1.7).
- **Offer page:** the deal, pool, creators given it, their posts and sales, plus "Add products", "Remove products" and "End offer now". Add and Remove are greyed out, with the reason, once the offer is given to a creator (1.10). An Ended offer's page has **Delete** instead (1.9); End offer now's box says the offer stays in the list as Ended until it is deleted.

### 1.13 Removed from the old offer engine
Whole-store offers · "Publish to store" and the store-direct path · "Pay at store / Online / Pre-book"
choices on an offer · the special offer inside creator terms · "Save to my offers" from terms · copying
an offer onto an invitation · the bulk "Attach offer" action in the product list · old offer shapes
(clean break; existing offers archived, test data).

---

## 2. Creator terms in a collaboration

### 2.1 Posting date and the join window (changed 1 Oct, v1.15)
- The **posting date** is the **last day** for the set's creators to go live: in the INFLX shop and
  on social media. It's set on the set. It is a deadline, not the one day everything appears: a
  creator who is ready earlier goes live earlier (4.1). After it she is late (4.10) and the
  collaboration is flagged Delayed.
- It must be **at least 7 days ahead** when the set is made; the brand may choose any later day.
  It locks when the first invitation is sent.
- Creators can be invited and can join until **posting date − 3 days**. That gives at least three days
  to negotiate, shoot, and build shoppable posts.

### 2.2 Terms by Aim

| Term | Pay for Sale | Hybrid | Pay for Content |
|---|---|---|---|
| Commission % (on what shoppers actually pay) | ✅ required, **above 0**, up to 100% | ✅ required | — |
| Fixed fee ₹ | — | ✅ required, can't be ₹0 | ✅ required |
| What she can sell: **Offers** (one or more) | ✅ | ✅ | — |
| What she can sell: **Products without offers** | ✅ | ✅ | — |
| Shoppable posts: at least N, set by INFLX (admin), locked | ✅ | ✅ | — |
| Deliverables, usage rights, note | — | — | ✅ unchanged |
| ~~Whole store / categories / chosen products~~ | ❌ removed | ❌ removed | — |
| ~~Follower offer / special offer~~ | ❌ replaced by Offers | ❌ replaced by Offers | — |

**At least one offer or one product without an offer is required** (Pay for Sale and Hybrid).
Pay for Sale commission must be above 0%; a collaboration whose whole point is commission can't pay nothing.

### 2.3 What she can sell, part 1: offers
- The brand ticks one or more of its offers. There's a "Select all".
- **Only offers that start on or before the posting date and end at least one day after it are
  shown** (changed 1 Oct, v1.15). The posting date is the last day to go live, so a creator who goes
  live on it must still have the offer, and an offer that starts later could never be live in time.
  Example, posting 8 Oct:
  - 1–20 Oct → shown;
  - 1–9 Oct → shown, with the warning below;
  - 5–20 Oct → shown (not started yet; her post goes live on the 5th, 4.1);
  - 1–8 Oct → **not shown** (ends on the last day itself);
  - 9–20 Oct → **not shown** (starts after the last day);
  - an offer that ended 5 Oct, or one starting 15 Oct → not shown.
- Each row shows the name, type, product count and dates.
- 🟡 If an offer ends within 7 days after the posting date, the brand sees a warning: *"This offer ends
  20 Oct, only 5 days after posting. When it ends, her posts using it are removed from the shop."*
- Offers are **linked, not copied**. The same offer can go to many creators, and one creator can get
  many offers of any types.

### 2.4 What she can sell, part 2: products without offers
- Choices: **None** · **All products without offers** · **Choose products** (the same pool builder:
  category → all / filters / search).
- Only products **not held by any offer from the day the terms are sent** appear (changed 1 Oct,
  v1.15; it was "on or after the posting date"). Her post at normal price can be live from the day
  INFLX approves it, so a product still inside an offer until then can't be given: jeans whose offer
  runs to 5 Oct can be given from 6 Oct, not before.
- To give a product that's in an offer, the brand gives that offer.
- The list is **frozen at sending**, including "All products without offers" (the products on the day of
  sending; products listed later don't join). These products sell at their normal price.
- Gift items never appear here.

### 2.5 Summary and sending
- Shown before sending: *"She can sell: 2 offers (39 products) + 12 products at normal price ·
  Commission: 10% on every sale."*
- Commission applies to offer products and products without offers alike.
- **"Use these terms for everyone"** copies commission, fee, the offer selection and the product list.

### 2.6 Negotiation
The creator can counter only money and content terms (unchanged): Pay for Sale → commission;
Hybrid → fee and commission; Pay for Content → fee, deliverables, usage rights. **Offers and products
can't be countered.**

### 2.7 The agreement
- The agreement lists **her offers as of signing** (name, deal, dates) and her products without offers,
  with the line: *"Offers end on their end date; when an offer ends, posts using it are removed from the
  shop."*
- This replaces the old rule that the follower offer never appears in the agreement.

### 2.8 After sending and signing
- Terms **can't be edited after sending** (existing rule: withdraw and invite again).
- **No offers can be added after signing.** A new offer means a new collaboration, which means a
  **new set**. The system allows one live collaboration per creator per set.

| Change | What happens to her collaboration |
|---|---|
| An offer ends (end date, or brand ends it early) | Her posts using it are **removed from the shop**. She is notified. |
| Brand wants to add or remove products in an offer she has | **Not allowed** (1.10, changed 1 Oct). The offer's products are frozen from the moment it is in her invitation. The brand can end the offer, or take a product off sale. |
| A product without an offer she has is later put into an offer | It **stays sellable in her posts at normal price** (she wasn't given that offer). |
| A product becomes unavailable (unpublished or deleted) | It's removed from her sellable list and her posts (existing rule). She is notified. |
| A product runs out of stock | It can't be bought until restocked. A post whose products are **all** out of stock is removed from the shop. |
| The brand ends an offer that is in invitations not yet signed | Before ending, the brand is warned ("in 3 unsigned invitations"). The offer drops out of those invitations and the creators are told. An invitation left with nothing to sell is **withdrawn automatically**. |

### 2.9 How long a collaboration lasts
- **Pay for Sale and Hybrid collaborations have no end date.** Her posts keep selling and earning
  until the offer's end date (for offer posts) or until all their products are out of stock.
- Pay for Content is unchanged.

### 2.10 Follower code (retired)
- The old per-creator-per-set **offer code** (her name + 3 characters) is **retired**. It can't tell which
  post or offer a shopper wants. The **post code** (4.14) does that job. If pay at store later needs a
  code, it uses the post code.

### 2.11 What the creator sees
- On the invitation, collaboration and agreement screens: her offers, **read-only** (name, deal,
  products, dates), and her list of products without offers.
- Each offer shows an example of what she earns on it, worked out on an example price and labelled
  "You earn" (e.g. "10% of ₹2,999 = ₹300").
- She's notified when an offer she has ends, products are removed from it, a product's price changes,
  or a product goes out of stock.

Locked screens: `features/creator-terms-v2/04-preview/mockups/`.

---

## 3. Money and credit

| # | Rule |
|---|---|
| M1 | A sale is credited to **the creator whose post the item was added from**, however long after the post went up. The old 30-day attribution window and the "last creator clicked" fallback don't apply to this model. |
| M2 | **Commission is per item.** A cart holding items from two creators' posts pays each creator on their own items. |
| M3 | Commission is on **what the shopper actually pays** for the item (after the offer, before delivery), at that post's collaboration's commission %. |
| M4 | **An offer applies strictly within one post**: one post, one creator, one collaboration. A bundle, volume tier or free gift is earned only by items added from the same post. |
| M5 | An item bought through a post gets **that post's offer** only. Products without offers sell at normal price. |
| M6 | A product in a collection works like a **one-product post** from the collaboration the creator picked it from: its offer applies to that item alone, and she earns her commission. |
| M7 | **Stock is real.** A purchase reduces stock; a return adds it back. (Today's system never reduces stock, so this must be built.) |
| M8 | Shoppers who have started paying keep the price they were shown, even if the offer or product changes in that moment. |
| M9 | The commission hold before it becomes withdrawable (return window, currently 30 days) is **unchanged**. It's a separate rule from M1. |
| M10 | **Pay at store** (the shopper types in a bill total) can't work out per-item offers. **OPEN**: its own discussion, with the founder's screens. |

---

## 4. Shoppable posts

### 4.1 When a creator can make posts
- After both signatures, and after the **shoot plan**. **OPEN**: the founder will provide the shoot-plan
  business rules that gate post creation.
- **A post goes live as soon as INFLX approves it** (changed 1 Oct, v1.15; it was "from the posting
  date"). The posting date is the last day to go live (2.1).
- **An offer post is visible to shoppers only while its offer is active.** Approved before the offer
  starts → it waits and goes live on the offer's start date. When the offer ends → it leaves the shop
  (4.9). A brand that wants one launch day gets it through the offer's start date.
- **INFLX admin approves every post** before it goes live.

### 4.2 The flow
1. Tap "Create shoppable post"
2. Select brand
3. Select collaboration
4. Post type: **Offer post** or **Price post**
5. Pick products (depends on post type)
6. Pick theme tags
7. Format: Static / Video → Single / Carousel
8. Upload media
9. Caption → Review → Publish (goes to admin approval)

**Drafts:** a post is saved automatically at every step and shows in "Your posts" as **Draft** until she
sends it. Tapping a draft carries on where she stopped. A draft can be deleted. Drafts have no code or links.

**Offer post, step 4 in detail:**
- 4a. Select the **offer type**. Only types she was given in this collaboration are shown, each with a
  count, e.g. Discount (2) · BOGO (1) · Bundle (3) · Free gift (1). Types with 0 offers are hidden, not greyed.
- 4b. Select **one** offer of that type. Each row shows the deal, product count and end date.
- 5. Pick products from that offer's pool.

**Price post, step 5 in detail:**
- Only her **products without offers** in this collaboration.
- Select a price band → select category or categories (any level; the post stores its products' actual
  leaves) → pick from the filtered list (at least 1).

### 4.3 Picking products in an offer post

| Offer | What the creator picks |
|---|---|
| Discount / BOGO / Volume | Any products from the pool, at least 1 |
| Bundle pick-any / Mix & match | At least the pick count, so a shopper can complete the bundle from this post |
| Bundle fixed | Nothing; all bundle products are added automatically |
| Free gift | Products from the buy pool. The gift shows automatically as "Free with this" |

### 4.4 Price bands
- **Five bands, managed by admin:** Under ₹499 · Under ₹999 · Under ₹1,999 · Under ₹2,999 · ₹3,000+.
  They replace today's nine.
- Bands are "under", so they include each other: a ₹450 post also shows in Under ₹999.

### 4.5 Theme tags
| Group | Tags |
|---|---|
| Season (4) | Summer, Winter, Monsoon, Spring |
| Occasion (9) | Office, Party, Wedding, Festive, College, Airport, Vacation, Date Night, Weekend |
| Style (9) | Minimal, Casual, Elegant, Classic, Trendy, Street Style, Korean Style, Boho, Vintage |
| Use (5) | Everyday, Travel, Gym, Workwear, Lounge |

- **At least 1 tag, at most 1 per group** (so up to 4). Example: Winter + Office + Classic + Workwear.
- Tags belong to the **post**, not the products. The same jeans can be Casual in one post and Office in another.
- Tags are **fixed once published**.
- The 27 tags are kept as given.

### 4.6 What each post carries (its four facets)

| Facet | Offer post | Price post |
|---|---|---|
| Category | Automatic: every leaf its products span (e.g. Men › Bottomwear › Jeans; a mix & match post carries all its categories) | Chosen by the creator; stores its products' leaves |
| Offer | Automatic: offer type + deal (e.g. BOGO), set at step 4a | None |
| Price band | Automatic (below) | Automatic (below). Her chosen band only filters what she picks |
| Theme | Chosen | Chosen |
| Tracking chain | brand, campaign, set, creator, post, products, offer | Same, minus the offer |

**Price band = the highest price a shopper pays for one item in the post:**
- Discount offers → the discounted price (₹1,000 at 30% off → ₹700 → Under ₹999).
- BOGO, Volume, Bundle, Free gift → the item's normal price.
- Price posts → the item's normal price.
- Recalculated automatically whenever a price changes (1.11).

### 4.7 Format and media
- Static or video; single or carousel. Video is just another kind of media.
- **How videos are delivered (decided 29 Sep, v1.7).** At launch videos play from INFLX's own storage
  (Cloudflare R2, which charges nothing for plays), made fast in four ways:
  1. the creator's phone **shrinks the video before upload** (about 720p; a 30-second clip is about 7–8 MB
     instead of 40–60 MB);
  2. the file is arranged to **start playing from the first second**;
  3. the shopper's phone **loads the next one or two videos** while she watches, and keeps recent ones;
  4. video links are **cacheable**, so repeat plays load from the nearest server.
  There is no limit on how many videos can play. What matters is each file's size against her network:
  smooth on good 4G and Wi-Fi; on a weak signal a video may pause to load.
- **Every pause to load is recorded** (5.14). A **video streaming service (Cloudflare Stream)**, which
  lowers quality on a weak signal instead of pausing, is added when those pauses become frequent
  (particularly in smaller cities). Roughly $5 per 1,000 minutes stored + $1 per 1,000 minutes watched.
- Playing videos, shrinking them on upload and opening collection links in the app need the **new app
  build** (APK of 30 Sep 2026, v1.8). Until a phone has it, a video shows its product's photo with
  "Update INFLX to play videos"; everything else works on the older build.
- **How the player behaves (v1.8):** a video plays only while it is on screen and the screen is in front;
  muted in feeds, with her own sound setting in Play (a sound button there); the next videos load while
  she watches; the phone keeps up to 200 MB of recent videos. An approved post's video link stays the same
  for 6 hours and may be cached; drafts and posts in review keep a 5-minute private link.
- **Shrinking (v1.8):** the creator app makes a video about 720p at 2 Mbps before upload. If the phone
  can't, or the result isn't smaller, the original is uploaded — a post is never lost.
- Product tap-points on images and the three tag styles (soft editorial, minimal, hidden) are kept; they can be removed later if unused.
- **No copyrighted music.** A warning shows when uploading. Admin checks it during approval.

### 4.8 Rules
- One brand, one collaboration per post. Multi-brand posts are dropped.
- **One offer per post.**
- Offer posts show only that collaboration's offers. Price posts show only that collaboration's products without offers.
- Tags are fixed once published.
- **Limits:** up to 10 photos or clips in a carousel, up to 30 products, a video clip up to 90 seconds.
- **Product tags on photos are optional.** Every picked product is in the post's product list anyway.
- **After sending:** nothing changes while INFLX checks it. **Sent back:** she may change photos and videos,
  caption, products and theme tags — not the brand, collaboration, post type or offer (for those, a new post).
- **Once approved, no edits.** She can **take a post down** herself: it leaves the shop and keeps its earnings history.

### 4.9 A post's life after it goes live

| Event | What happens to the post |
|---|---|
| The offer's end date passes, or the brand ends it early | **Removed from the shop.** Its media promises the offer, so it can't sell at full price. The creator is notified. |
| Brand removes some of the post's products from the offer | Those products leave the post. If none are left, the post is removed. |
| A product becomes unavailable | It leaves the post. If none are left, the post is removed. |
| All the post's products are out of stock | Removed from the shop. |
| Every gift in its free-gift offer's pool is gone (6.4, v1.9) | Removed from the shop: it can no longer keep its promise. |
| A product's price changes | The post's price band recalculates. The creator is told. |
| A price post (no offer) | Ends only when all its products are out of stock or unavailable. |

### 4.10 Minimum shoppable posts
- Admin sets the minimum (currently 1). It's copied into her terms and locked.
- Counted as **approved posts in this collaboration by the posting date**.
- If missed, it's **flagged to the brand**, with no automatic penalty for now.

### 4.11 Collections
- The creator gives a collection a **name** and picks either **posts** (from the posts she created) or
  **products** (from products allocated to her through her collaborations). Nothing more.
- A collection can mix brands.
- Collections need **no admin approval**. They only hold approved posts and her allocated products.
- A product in a collection works like a one-product post (M6).
- Admin "theme collections" are retired; theme tags do that job now.
- She can **rename, add or remove items, or delete** a collection any time. A collection stays posts-only or
  products-only. It **hides itself** from shoppers when nothing in it is still in the shop. Deleting a collection
  never touches her posts.

### 4.12 Discovery
- Every post carries four facets: **Category · Offer · Price band · Theme**.
- Shoppers can filter by any combination. The same four filters appear on **Discover**, the **Brand
  Store** and the **Creator Store**.
- **Admin rails are saved filters** over the four facets (e.g. "Winter Pants BOGO Under ₹499" = Winter +
  Pants + BOGO + Under ₹499). They replace admin-built "concepts", which are retired. Posts appear in
  rails automatically when their facets match.
- **OPEN**: the rails design will be discussed in detail before it's rebuilt.

### 4.13 Brand store
- Made only of creators' posts for that brand (one brand per post makes this exact).

### 4.14 Store links, post links, post codes, collection links
From the founder's "Post Code and Links" document and screens, and the 11 points agreed on 28 Sep.
Locked-pending screens: `features/post-links-codes/04-preview/mockups/`.

| What | Example | Where the creator finds it | Best used in |
|---|---|---|---|
| **Store link** | `inflx.in/s/priya/ig` | Create → My store and collection links | Bio |
| **Post link** | `inflx.in/p/K7M2F9/ig` | Your posts → Share | Where links can be tapped: stories, YouTube, WhatsApp |
| **Post code** | `K7M2F9` | Your posts → Share | Captions, where links can't be tapped |
| **Collection link** | `inflx.in/c/DSR4K2` | Create → My store and collection links | Sharing one picks list |

**Channels.** Five endings: `/ig` Instagram · `/yt` YouTube · `/wa` WhatsApp · `/fb` Facebook · `/o` Other
(X, LinkedIn, Telegram, SMS, a blog…). Every ending opens the same thing; the ending only tells INFLX which
channel the visit came from. (Replaces the August list of seven; X and LinkedIn go under Other.)

**Store link**
- Every creator has one: `inflx.in/s/<handle>`, with the five channel endings.
- It opens her Creator Store, with all her live posts and collections.
- It suits a bio: it stays right as posts come and go.
- It uses her handle. **If she changes her handle, her old store links keep working forever** and open her
  store under the new handle.

**Post links**
- Each post gets `inflx.in/p/<code>` with the five channel endings.
- A tap opens that post straight away, with its products and the offer already applied.
- **They appear the moment INFLX approves the post**, and open the post at once (v1.15). Only an offer
  post whose offer has not started yet shows "This post goes live on <the offer's start>". The old
  wording, kept for the record: Before the posting date, a tap shows "This post goes
  live on <date>" and her store. Posts in review and drafts have no links.
- The `/p/` address was used for single-product links; products are no longer shared on their own, so it
  now belongs to posts.

**Post code**
- The same post as its link, written as 6 characters, e.g. `K7M2F9`.
- Letters and numbers only · no vowels (a code never spells a word) · no look-alike characters (0/O, 1/I and
  similar) · capitals don't matter (`k7m2f9` works) · one code per post, never changes.
- Created with the post links, at approval.
- **Characters used:** B C D F G H J K M N P Q R S T V W X Y Z and 2–9 (no vowels; no 0, O, 1, I or L). A
  collection link uses the same characters.
- A link with no ending, or an ending INFLX doesn't know, counts as **Other**. Link previews (WhatsApp, Facebook,
  X and similar) are not counted as visits.
- It comes with a ready caption line: *"Shop this look on INFLX: search code K7M2F9"*.
- A follower can use it three ways: type it in INFLX search ("Search or enter a post code"), type it in the
  "Have a post code?" box (bag and home screen), or open `inflx.in/p/K7M2F9`.
- **Brands** see the codes of posts made for them and can **copy them all** as a ready list (post and creator
  names) for posters, their own posts or WhatsApp.

**Collection link**
- One link per collection, with no channel endings: `inflx.in/c/<code>`.
- It opens that collection inside her store.
- An order through it pays her under the collaboration each product came from (M6).

**Where she shares what**

| Place | What she uses |
|---|---|
| Reel or post caption (Instagram, Facebook) | Caption line with the post code |
| Story (Instagram, Facebook) | Link sticker with the post link (`/ig` or `/fb`) |
| Bio (Instagram, YouTube) | Store link |
| YouTube video or Short | Post link `/yt`, in the description or a pinned comment |
| WhatsApp status, chats, groups | Post link `/wa` |
| Anywhere else (X, LinkedIn, Telegram, SMS, a blog) | Post link `/o` |

**What the follower experiences**
- App installed: the link opens the post or store inside INFLX.
- No app: a web page shows the post with a "Get the app" button. After installing, the same post opens.
- At checkout the offer applies automatically. No code is needed, and the creator gets her agreed commission.
- **A removed post, or a hidden or deleted collection:** the link shows "This post is no longer available"
  (or the collection equivalent) plus her store. No old link is a dead end.
- **Opening the app from a link (v1.8):** `inflx.in/p/…`, `/s/…` and `/c/…` open in the shopper app only
  (the brand and creator apps no longer offer to open them). Until INFLX publishes its app-link file with the
  production signing key, Android asks "open with INFLX or the browser" the first time.
- **Opening the right post after installing from a link** needs the app on the **Play Store** (Google passes
  the link to a new install). The apps are shared as APK files today, so this waits for the Play Store listing.

**Tracking (reporting only)**
- **Visit:** every tap on one of her links counts as a visit for that link's channel. A typed code counts as a
  **"Post code"** visit.
- **Which channel an order counts under:** each item is labelled with the latest tap on **that creator's**
  links (her store link or that post's links) in the **30 days** before buying. With no such tap, it counts as
  **"In INFLX"**.
- A tap made before the follower signs in is remembered on the phone.
- Admin can change the 30 days; the change applies to new taps only.
- **The channel never changes who is paid, her commission or the INFLX fee.** Credit follows M1: the post's
  creator, with no time limit.
- INFLX also records, admin-only, where a tap really came from when it differs from the link's ending (e.g. an
  Instagram link pasted into WhatsApp). It never changes the creator's numbers.

**Who sees what**
- **Creator:** visits and orders by channel, sales and commission for each post (a post's Stats); store link
  visits by channel; collection link visits. **Never who bought.**
- **Brand:** every post made for it, with code, visits, orders, sales and commission; the list of post codes;
  shop orders by creator; the INFLX fee and what it receives.
- **INFLX admin:** everything, across all creators and brands, plus the platform fee; the 30-day setting.

**Follower side (rule only; screens come with the shopper app).** A follower who types a post code in INFLX
search gets exactly that post, with its products and offer applied.

### 4.15 Engagement on INFLX posts
Screens (pending lock): `features/post-performance/04-preview/mockups/`.
- **Built in two halves (v1.7).** The **shopper side** comes with the shopper app: view, like, comment,
  report a comment, save, share, and the counts on each post. The **creator's reply and hide** and the
  **brand's view** come with the post-performance board (Level 5).
- Followers can **view, like, comment on, share and save** a live INFLX post.
- **Counts kept per post:** views (the post opened), likes, comments, shares (share taps inside INFLX), saves.
- Liking and commenting need **sign-in**. Saving and following work for guests (kept on the phone until sign-in, 5.2). Sharing works for guests. Views count for everyone.
- **Comments:** text only, up to 300 characters, newest first.
  - The **creator** can reply and hide a comment on her own post (and unhide it).
  - **Followers** can report a comment. **INFLX admin** removes what breaks the rules (reports queue next to
    post approvals).
  - The **brand** can read comments on posts made for it, but can't hide or remove them.
- Shown to the **creator** (each of her posts) and the **brand** (each post made for it). Admin sees all.
- Reporting only: engagement never changes pay.

### 4.16 Social media numbers for each post
- **Going live (Pay for Sale and Hybrid):** after the posting date, for **each approved shoppable post**, the
  creator adds the links of the social posts where she shared it: an Instagram reel or post, a YouTube video
  or Short, a Facebook post. One INFLX post can have several. A **story** gets a screenshot instead (stories
  can't be tracked).
- **Pay for Content:** the live links she already hands in at the content step are used. Nothing extra is asked.
- **Deadline:** within **2 days of the posting date**. If links are missing, it's flagged to the brand, with no
  penalty (like minimum posts).
- **Her own account only.** A link from another account is refused when added, and flagged if the scrape
  shows a different owner.
- **Numbers fetched** (by scraping the linked post): views, likes, comments, and shares where the platform
  makes them public (YouTube doesn't). Each shows when it was last updated.
- **Platforms:** Instagram and YouTube from the start. Facebook links are accepted and shown; their numbers
  come later. Stories and WhatsApp: screenshot or nothing.
- **How often:** daily for the first **30 days** after posting, then **weekly** while the post is live, and it
  stops when the post leaves the shop. Pay for Content: daily until the final payment.
- Shown to the **creator** and the **brand** on the post's Performance screen (on INFLX · on social media ·
  shopping), in the brand's posts list, and next to each link on the Pay for Content content screen.
- Reporting only: social numbers never change pay.

---

## 5. The follower (shopper) app

Agreed with the founder on 28 Sep 2026 from the founder's "Followers app skeleton ideas". Screens:
`features/follower-app-v2/04-preview/mockups/` (pending lock). Checkout, returns, addresses and pay at
store come next, in their own discussion.

### 5.1 Navigation
- **Bottom bar (5):** Home · Discover · ▶ Play · Saved · Profile.
- **Top bar on every screen:** a **search** icon and a **bag** icon with the item count. The bag is always
  one tap away; search is where a post code is typed.
- **Profile:** orders, settings, policies, her city, sign in / out. (Returns and addresses: next discussion.)
- **No shopper wallet.** Refunds go back to the original payment and show inside the order.
- **Until ordering is built (v1.7):** there is no Add and no bag. Shop this post shows the products
  with the offer applied and a heart to save each one. **With ordering (section 6, v1.9)** the bag icon with its
  count joins the top bar, and Shop this post gets Add and Go to bag (6.3).

### 5.2 Guests and sign-in
- Shoppers browse as guests until they order.
- **Guests can follow and save.** Both are kept on the phone and moved to the account at sign-in.
- **Liking and commenting need sign-in** (they're public). Sharing works for guests. Views count for everyone.
  (This updates 4.15, which asked for sign-in to save.)

### 5.3 Where she is (changed 29 Sep, v1.7)
- **The shopper app asks for the phone's current location** to show posts near her and in her city.
  Only the shopper app asks; the brand and creator apps never do.
- **Used, never stored.** The phone sends its location with each feed request; the server uses it to order
  that page and keeps nothing. Coordinates stored by the old app are cleared (none were held in production).
- **If she says no, or location is off,** she picks her city from the **146 offered cities** and its fixed
  centre point is used instead. She can change it any time in Profile.
- **"Near"** = a creator's city centre, or any of the brand's store branches, within a **range** (km) of
  where she is. The range is set by INFLX admin.

### 5.4 Welcome (first open, optional)
- One screen: **Women · Men · Kids**, a few **styles** from the theme tags, and **"Use my location"** or
  **"Pick my city"** (5.3). It can be skipped.
- It gives the feed something to go on from day one (the cold start).

### 5.5 Home
- **Top: two rows of circles.** **Creators** first, then **Brands**.
  - **Order:** (1) creators she follows; (2) creators whose posts she liked, watched or shopped from; (3) brands
    she bought from or visited; (4) popular creators in her categories and city.
  - A **coloured ring** means "new posts since your last visit", and ringed circles come first.
  - Only creators and brands with **live posts** appear.
  - Tapping a creator opens her **creator store**; tapping a brand opens the **brand store**.
- **Below: a mixed feed** of photo and video posts, ordered by the feed rules (5.12).
- **Every post shows:** the creator (name and avatar, tap → creator store), the brand (tap → brand store),
  **Shop this post**, and **like · comment · share · save**.

### 5.6 Opening posts
- **Shop this post** → a sheet slides up with the post's products and the offer applied. Each product can be
  **hearted** (saved) or added to the bag.
- **Tapping a photo post** → it opens at its own size, and the feed below continues with **that creator's
  posts**, newest first. When those run out, it carries on with **similar posts** (same brand or category),
  so it never dead-ends.
- **Tapping a video** → it opens **full screen**, and swiping carries on through **all creators' videos**.

### 5.7 Play
- **Play = full-screen videos only**, all creators, autoplaying, swipe up for the next (like Reels). It is not
  a second copy of Home.
- Each video shows the creator, brand, Shop this post, and like · comment · share · save.

### 5.8 Saved
- Two parts: **Posts** (bookmarked from a post) and **Products** (hearted from Shop this post).
- **A saved product remembers the post it came from.** Buying it from Saved credits that post's creator and
  applies that post's offer (M1, M5).
- If that post has left the shop, the product shows **"No longer available with this offer"** and lists
  **other live posts** carrying the same product. It can't be bought outside a post (P1).
- Guests' saves live on the phone until sign-in (5.2).

### 5.9 Creator store
- Top: avatar, bio, **INFLX followers**, **Follow** button.
- A row of circles: **brands she has collaborated with** (tap → brand store).
- A row of circles: **categories she has posted in** (tap → filters her store).
- Tabs: **Posts** (photos and videos, newest first) · **Videos** (videos only, newest first) ·
  **Collections**. Grids are **2 × 2**.
- Tapping a tile starts a feed from that post, newest to oldest.
- A **collection** opens with its name and its posts or products (4.11).

### 5.10 Brand store
- Made only of creators' posts for this brand.
- Top: a row of **category circles** (only categories it has posts in) and a row of **creator circles**
  (only creators who collaborated with it).
- Below: its posts, using the same 2 × 2 grid and feed behaviour.
- A floating **Offers** button opens the brand's offers:
  - filters are our four: **category · offer type** (BOGO, Bundle, Discount, Buy more save more, Free gift) **·
    price band · theme**;
  - tapping an offer shows **the posts that carry it** (every purchase goes through a post);
  - an offer with no live posts is hidden.
- (Pay at store may later sit here; its own discussion.)

### 5.11 Search
- "Search or enter a post code". A post code shows exactly that post (4.14); otherwise results are creators,
  brands and posts.

### 5.12 The feed (how posts are ordered), rewritten 29 Sep, v1.7

**Where it applies.** The feed rules order **Home** and **Play**. A post never disappears anywhere else:
the creator store, brand store, search, Saved, collections, its link and its code always show it.

**What can appear.** Live posts only: approved (the posting date is not asked, v1.15), its offer active
if it has one, not removed, at least one product
in stock and on sale. Play takes videos only.

**Her Women / Men / Kids choice is a preference, never a filter** (changed 1 Oct, v1.16). Every live
post is in her feed. The posts she shops for come first (Unisex counts for everyone; so does a post
with no category); the rest follow in the usual order. A shopper who chose only Men still sees
what exists when there is nothing for men. The choice is one of the signals the feed that learns
(Stage B) will weigh once there is enough to learn from about a shopper.

#### Stage A: the rules feed (on from launch)
1. **Order:**
   1. posts from **creators she follows**, newest first;
   2. then posts **near her** (5.3), newest first;
   3. then **everything else**, newest first.

   Posts whose theme matches the **styles she picked** on Welcome move up a little within each group.
2. **Fixed rules, always on:**
   - **never the same creator twice in a row**;
   - **15% of places go to brand-new posts** (live for under 48 hours), so a new post is seen and can earn a score;
   - sold-out and removed posts drop out the moment they change;
   - **never repeat** (below).
3. **Never repeat.** A post she has **seen** (5.14) doesn't come back in the feed for **30 days**. Unseen
   posts always come first. When she has seen everything, the feed says **"You're all caught up"** and
   then shows seen posts again, **the one she saw longest ago first**. The feed is never empty.
4. **Opening a post continues the feed:**
   - a photo: **that creator's posts**, newest first, then **similar posts** (same brand or category);
   - a video: full screen, then **all creators' videos** in Play order.
5. **Home circles** (5.5): creators she follows, then creators she engaged with (liked, watched, saved,
   shopped), then brands she visited or bought from, then popular creators near her. Ringed circles (new
   posts since her last visit) come first.

#### Stage B: the feed that learns (built now, switched OFF)
Each live post gets a score for her. Four dials, each a weight INFLX admin sets **without an app update**:

| Dial | What it measures |
|---|---|
| **What she does** | Her past actions on the post's creator, brand, category, theme, offer type and price band. A purchase counts most, then add to bag, save, like, a finished video, time spent, a plain view. Older actions fade: **half their weight every 14 days**. |
| **How recent** | The post's age: **half its freshness every 3 days**. |
| **How near** | Full marks within the admin range of where she is (5.3), falling with distance. |
| **How it performs** | Across all shoppers: shop taps, saves, likes and finished videos per view, adjusted so a post with a few lucky views can't jump to the top. Recalculated every hour. |

The fixed rules of Stage A still apply on top.

**The switch (the cutoff).** Stage B stays off until INFLX switches it on. The cutoff is not a date:
- **Recording starts on day one** (5.14), so data builds from the first shopper.
- Admin sees a **readiness panel**: shoppers with 20+ actions, total actions, days of data.
- Admin sees a **preview**: for any shopper, "feed today" beside "feed if learning were on".
- When the numbers and the preview look right (guide: a few hundred active shoppers, 3–4 weeks), admin
  switches it on. No app update, no new build. The dials can be changed the same way at any time.

### 5.13 Discover
- Designed by admin. **OPEN**: the founder will explain how admin designs it (with the saved-filter rails, 4.12).
- **Until then (v1.7) the Discover tab shows "Coming soon".**

### 5.14 What the app records (from day one)
The phone knows which post is on screen and for how long, and records it for the feed (5.12) and for
reporting. **Recording never changes pay.** Nobody (creator, brand or admin) sees one person's viewing;
only totals are shown.

| What she does | What is recorded |
|---|---|
| Scrolls past in under 1 second | Nothing: **not seen** |
| A post is **at least half on screen for 1 second** | **Seen** (it won't repeat for 30 days, 5.12) |
| She stays on a photo | How long: 10 s, 30 s… |
| She watches a video | Seconds watched, whether it reached the end, replays, pause, sound on and off, and **every pause to load** (4.7) |
| She taps | Open, Shop this post, a product, like, comment, save, share, the creator, the brand |

- The phone sends these in small batches every few seconds and when she leaves the app. If the phone is
  switched off suddenly, the last few seconds may be lost.
- **Guests** are recorded under the phone's anonymous ID; their records join her account when she signs in.

---

## 6. Ordering: bag, buy now, checkout, orders, cancelling

Agreed with the founder on 30 Sep 2026: all ten points of the ordering discussion, as recommended, from the
founder's reference screens (Myntra) and the rules above. Screens: `features/shopper-ordering/04-preview/mockups/`
(**LOCKED 30 Sep 2026**, final board `shopper-ordering-mockups-final.html`: O1, O2, D1, P1–P3, B1–B4, V1–V4,
K1–K5, G1–G5, D4, D11, O6–O17; 38 screens). **Returns and exchanges come next, in their own discussion; pay at store stays O5.**

### 6.1 The principles
| # | Principle |
|---|---|
| R1 | **Every item in the bag remembers the post it came from** (or the collection item, M6). That post fixes its offer, its price and which creator earns the commission (M1, M5). An item can never be bought outside a post (P1). |
| R2 | **Offers work only inside one post (M4).** The bag is grouped by post. A bundle, a volume tier, a BOGO or a free gift counts only the items added from that same post. |
| R3 | **One bag for everything.** A bag can hold items from many creators and many brands. |
| R4 | **One checkout, one payment, one order per brand.** Each brand packs and ships its own parcel. |
| R5 | **The server works out every price.** The phone only shows it. The amount on "Place order" is exactly what she pays (M8). |
| R6 | **Stock is real (M7).** It goes down when an order is placed and back up when an item is cancelled (or later returned). |

### 6.2 Two kinds of item
**A. Simple items:** a price post (normal price), or an offer post with a **Discount** (% off, with its optional
maximum per item, or ₹ off). Each item stands alone. Choose size → **Buy now** or **Add to bag** → address → pay.

**B. Deal items:** BOGO, Volume (buy more save more), Bundle (pick any, mix & match, fixed) and Free gift. Each
needs one extra step from the shopper, and the app guides it (6.4).

**One item of an offer can also be bought alone (v1.19, founder 5 Oct 2026).** On an offer post a shopper may buy a
single product **at its normal price**; the offer is shown beside it, and its price applies only once the offer is
completed — never a part of it. Which offers allow it:

| Offer | One product alone? |
|---|---|
| Bundle (pick any, mix & match) | Yes, at its normal price |
| Volume (buy more save more) | Yes, at its normal price (it is the first step of the ladder) |
| Free gift (spend, buy X) | Yes (it already paid its own price) |
| BOGO | **No.** She pays the same either way and would lose the free one |
| Bundle, fixed (a set) | **Only if the brand switched on "Pieces can also be bought alone"** for that offer (1.x numbers; off unless switched on; set while the offer is a draft and frozen with its other numbers at publish) |

An item bought alone is an ordinary sale through that post: its own order line, cancelled and returned on its own,
and the creator earns her collaboration % on what was paid (6.13).

### 6.3 Choosing size and colour (O1)
- On a **simple post** (normal price or a discount), tapping **Add** on a product in Shop this post (F3) opens the
  **size and colour sheet**: its colours, its sizes with stock, sold-out sizes crossed out, and "Only 2 left" when 3
  or fewer remain. On a **deal post** whose products can be bought alone (6.2), **Add** opens this same sheet at the
  product's normal price, with the line "Or get it in the offer: Any 3 for ₹2,999 ›" under the buttons, which opens
  the **deal page** (6.5) with that product started. On a BOGO post, or a set sold only whole, **Add** opens the
  deal page, where each product she taps opens the **product pop-up** (P2) rather than this sheet.
- **The product page** on a deal post (v1.19): "Buy this alone · ₹1,999" over **Buy now** and **Add to bag**, and the
  strip "In an offer: Any 3 for ₹2,999 · See offer ›". On a BOGO post: "Buy one, get one free. Pick your free one
  next." and one button, **Get this offer**. On a set sold only whole: "Sold as a set." and **Build your deal**.
- A **size chart** link shows only when the brand has given one.
- The sheet shows the price she pays for one (after a discount) with the normal price struck, and the post's
  offer line ("20% off applied", "Any 2 for ₹2,999", "Buy one, get the same free").
- Two buttons: **Add to bag** and **Buy now**. Quantity starts at 1.
- Shop this post (F3) now shows **Add** on each product and **Go to bag** with the count, and the bag icon with its
  count joins the top bar on every screen (5.1). The ♡ still saves the product with its post (5.8).

### 6.4 How each offer works in the bag (all within one post, R2)
| Offer | What she is guided to do | How the price is worked out |
|---|---|---|
| **Discount** (% or ₹ off) | Nothing extra | Each item at its discounted price (a % discount stops at its maximum ₹ off per item). |
| **BOGO** | On the deal page (B1–B4): tap a product; its pop-up asks the paid one's colour and size, then the free one's (the same product, any colour or size); the pair is listed | Every paid unit can take one free unit of the same product, up to the offer's maximum free items per order. The free unit costs ₹0 whatever that variant costs. |
| **Volume by quantity** | On the deal page (V1–V3): the tier ladder at the top, quantity chosen in each product's pop-up, "1 more → 30% off" | Count every unit from the post. The highest tier reached applies; tiers replace each other and never add up. A % reward comes off every unit; a ₹ reward comes off the post's items once. |
| **Volume by value** | The same deal page (V4), the ladder in ₹: "Spend ₹550 more → 20% off" | The same, counting the normal-price total of the post's items. |
| **Bundle, pick any / mix & match** | On the deal page (K1–K3): the set's empty slots at the top, every product below (mix & match: one tab per category), "2 of 3 picked" | Every full set of N units costs the bundle price. The costliest units go into sets first (the best saving for her). Units left over — or bought alone, before any set is full (v1.19) — pay their normal price, with "Add 2 more from this post and get all 3 for ₹2,999" or "Add 1 more to complete another set". |
| **Bundle, fixed** | On the deal page (K4, K5): every item of the set, each chosen in its own pop-up | Sold only as the whole set, at the bundle price. Removing one item removes the set; quantity changes whole sets. **Unless the brand allows its pieces alone (6.2):** then a piece outside a whole set pays its normal price, and whole sets among her picks still cost the set's price. |
| **Free gift, spend** | On the deal page in two steps (G1, G3, G4, then the review D4): **1 · choose what you buy**, with the progress to the gift; **2 · choose your gift** from all the gifts, shown clearly; then review | When the normal-price total of the post's buy-pool items reaches the minimum, she gets the offer's number of gifts, **once per order**. One gift in the pool is added by itself. |
| **Free gift, buy X** | The same two steps, counting items (G2); one gift in the pool is added by itself (G5) | The same, counting units. |

- **Rounding:** a % comes off **each unit and is rounded to the nearest rupee** (₹999 at 20% off → ₹799). When a
  price is shared across items (6.13), the parts are rounded and any leftover rupee goes to the costliest item, so
  the parts always add up to the deal price.
- **Progress and nudges** show on the post's group in the bag, with **"Edit deal"** and **"Add more from this post"**,
  which reopen that post's deal page with her picks already in it.
- **Gifts are limited.** A gift goes only while its stock and the offer's gift limit last; each gift given counts
  against both. **When every gift in an offer's pool is gone, the offer can no longer keep its promise:** the posts
  carrying it leave the shop (as when all products sell out, 4.9), and bags show "No longer available with this
  offer" (6.6).
- A **gift item** (never sold, 1.7) shows its value ("worth ₹650"). A **store product given as a gift** shows ₹0 "Free".

### 6.5 The deal page (one for each kind of offer) and Buy now (D1, P1–P3, B1–B4, V1–V4, K1–K5, G1–G5, D4, D11)
A deal post can carry 20 products and 10 gifts, so a deal is never built in a small pop-up. **Every deal post opens
a full-screen deal page** where she sees everything clearly, one step at a time.

**Opening it.** On a deal post, Shop this post (F3) shows the offer, how it works, how many products (and gifts)
there are, and **Build your deal** (D1). The deal page also opens from **See offer ›** on a product's page and from
"Or get it in the offer ›" in the size sheet (that product arrives already picked); from **Add** on a product of a
BOGO post or of a set sold only whole; and from **Edit deal**, **See offer ›** or **Add more from this post** in the
bag (her picks are already in it). Where a product can be bought alone (6.2), **Add** adds it alone instead (6.3).

**What every deal page has**
- **The deal at the top:** creator, brand, the deal line, a one-line "how it works", and the end date.
- **Every product of the post in a 2-column grid** (P1), each with its photo, name, price (a discount already applied)
  and how many colours and sizes it has. **Sold-out products are shown greyed** at the end, never hidden.
- **When there are more than 8 products:** category chips (with counts) and **Sort: price low to high / high to low**.
- **Tapping a product opens the product pop-up** (P2) right there on the deal page (v1.11): its photos (swipe),
  name, brand, price (with the deal's effect shown, e.g. "Counts toward Buy 3 → 30% off"), its details
  (fabric, fit, care, what the brand wrote), its **colours** as swatches, its **sizes** with stock (sold-out
  crossed out, "Only 2 left"), the size chart when the brand gave one, and any other choice the product has.
  She chooses, taps **Pick** (or **Add**, or **Choose gift**), the pop-up closes, and the card shows
  "✓ Picked · Blue · M" (P3). Tapping a picked card reopens its pop-up to change the colour or size, or **Remove**.
  Then she taps the next product. Nothing is picked without its colour and size chosen.
- **Her picks show where she picked them:** on the cards ("✓ Picked · Ivory · M", "×2"), in the bundle's slots, or
  in the BOGO pair list; the review (D4) lists them all with Change and Remove.
- **A sticky bar** at the bottom: the progress ("2 of 3 picked", "₹550 more to unlock your gift", "1 more for 30%
  off"), what she pays and saves, and the main button.
- **A review before the bag (D4):** every item with its size, the gift if any, the deal price, the normal price struck
  and "You save ₹X", then **Add to bag** and **Buy now**.

**One page for each kind of offer**
| Offer | How the page guides her |
|---|---|
| **Free gift** (spend or buy X) | **Two steps, shown at the top: 1 · Choose what you buy → 2 · Choose your gift.** Step 1 is the product grid with a progress bar to the gift ("₹2,450 of ₹3,000, spend ₹550 more"). Step 2 unlocks when she reaches it: **every gift in a grid** with its photo, name and "worth ₹650", "3 left" when few remain, and "All given" greyed. She picks the offer's number of gifts ("Choose 1 of 10"). If she goes below the threshold, the gift step locks again and her gift is removed. |
| **Bundle, pick any** | **The set's empty slots at the top** ("Pick 3: ☐ ☐ ☐"), filled with the photo of each pick. The grid below. When the set is full: "Set complete · ₹2,999 · you save ₹1,299", with **Add another set** or **Review**. The main button works only on full sets. |
| **Bundle, mix & match** | The same slots, and **one tab per category** of the pool with its count ("Shirts 8 · Trousers 6 · Jeans 6"), so she can see each category clearly. Any mix fills the set. |
| **Bundle, fixed** | **The whole set as a list**: every item with its own size and colour choice, the total at normal price struck and the set price. The button works when every item has its size. Quantity changes whole sets. |
| **Volume** (quantity or value) | **The tier ladder at the top** ("Buy 2 · 20% off → Buy 3 · 30% off"), her tier filled and the next dashed. **The pop-up says what picking does** ("This makes 3 items → 30% off all three: this one ₹1,259") and lets her choose a quantity; picked cards show the price after the tier and "×2". The sticky bar: "3 items · 30% off · you pay ₹2,097, save ₹900". Tiers replace each other. |
| **BOGO** | **Tap a product** (B1). **Its pop-up has two parts:** 1 · the one she pays for (colour, size) → **Next: your free one** → 2 · the free one, the same product in any colour and size → **Pick this pair** (B2, B3). The pair is listed with Change and Remove (B4); **another pair** until the offer's maximum free items per order. |
| **Discount** and **price posts** | No deal page: each product is added on its own (6.3). |

**The four deal types and their sub-types, as the shopper meets them (final board: `shopper-ordering-mockups-final.html`)**
| Type | Sub-type | What the shopper sees and does |
|---|---|---|
| **BOGO** | One kind only: buy one, get the **same product** free | Choose a product → the pop-up asks the paid one's colour and size, then the free one's (any colour or size of that product) → the pair. More pairs up to the offer's maximum free items per order. |
| **Volume** | **By quantity**, reward in **%** | Ladder "Buy 2 · 20% → Buy 3 · 30%". Every unit from the post counts; the % comes off every unit. |
| | **By quantity**, reward in **₹** | Ladder "Buy 2 · ₹200 off → Buy 3 · ₹400 off". The ₹ comes off her total for this post once. |
| | **By value**, reward in % or ₹ | Ladder in ₹ spent: "Spend ₹2,000 · 10% → Spend ₹3,000 · 20%", counted at normal prices. |
| **Bundle** | **Pick any** (one category) | Slots "Pick 2", one grid of the category's products; every full set costs the bundle price. |
| | **Mix & match** (several categories) | The same slots with one tab per category; any mix fills a set. |
| | **Fixed** (exact products) | The set as a list; each item's pop-up asks its colour and size; the set is sold whole. |
| **Free gift** | **Spend threshold** | Step 1 buy (progress in ₹ to the minimum) → step 2 choose the gift(s) from all the gifts, each gift in its own pop-up (a store product given as a gift asks its size too). |
| | **Buy X get Y** | The same two steps, progress in items ("1 of 2 bought"). |
| | **One gift in the pool** | No choosing: "Your gift: Silver coin" is added by itself when she reaches it. |

**Buy now**
- **Simple item:** straight to checkout with that one item.
- **Deal:** from the deal page's review, straight to checkout with that deal only. A volume or free-gift deal below its
  threshold can still be bought at what it costs then, with the nudge shown.
- **Buy now never changes the bag.** What is in the bag stays there.

### 6.6 The bag (O6, O7)
- **Grouped by post:** each group shows the creator (avatar, name), the brand and the offer, then its items, then its
  progress or nudge. A deal group shows its sets and gift together (D11) with **Edit deal**, which reopens the deal
  page.
- **Items bought alone from an offer post (v1.19):** each is an ordinary row (quantity, Change, Remove, Move to
  Saved) at its normal price, with the nudge to complete the offer and **See offer ›**. **When her ticked items from
  one post complete the offer, the offer's price applies by itself** — she is not asked — and they show as one deal
  (one tick, Edit deal, Remove deal), with "The offer applied by itself." Anything beyond what the deal needs stays an
  ordinary row under it. Taking an item out, or unticking it, un-applies the offer the same way: the server prices
  what is left.
- Each item: photo, name, size and colour, quantity, the price she pays with the normal price struck, and **Change**
  (size, colour, quantity), **Remove**, **Move to Saved** (it keeps its post, 5.8).
- **Quantity:** 1 to 5 of one size per item.
- **Tick boxes:** every item starts ticked. Only ticked items go to checkout, and deals are worked out on the ticked
  items. Unticked items stay in the bag.
- **When something changes after she added it:**
  - the **price** changed: the new price shows with the old one ("Price changed from ₹1,200");
  - her **size sold out**: "Sold out in this size. Change size", and the item can't go to checkout;
  - the **offer ended or the post left the shop**: "No longer available with this offer", with the other live
    posts that carry the product (like Saved, 5.8); it can't be bought outside a post;
  - the **product is no longer sold**: "No longer available", with Remove.
- **Price details** at the bottom: items at normal price, offer savings, delivery (free, 6.10), cash on delivery fee
  when chosen, and the total. Then **Continue**.
- **Guests** fill a bag without signing in; it is kept on the phone (5.2). **"Continue" asks a guest to sign in**
  with her number (O8), and her bag, saves and follows move to her account.

### 6.7 Addresses (O9, O10)
- **Entered by hand for now.** No map or Google location lookup.
- Fields: **name, phone (10 digits), house/flat/building, area/street, landmark (optional), pincode (6 digits),
  city, state** (from the list), and **Home / Work / Other**.
- She can keep up to **10 addresses**, choose a **default**, edit and delete them. Deleting never changes a past
  order's address.
- **Any 6-digit pincode is accepted.** There is no courier coverage check until courier booking arrives.
- The checkout opens on her default address with **Change**.

### 6.8 Review and pay (O11, O12)
- **One card per brand parcel:** the brand, its items (with their creators), and **"Arrives by <date>"**, worked out
  from the brand's distance to the address (the existing estimate).
- **Price details:** items at normal price · offer savings · delivery · cash on delivery fee · **total**, and "You're
  saving ₹X".
- **Payment:** **UPI, cards, net banking** through Razorpay, or **Cash on delivery**.
  - Cash on delivery is offered only up to **₹5,000** per checkout; above that it is shown greyed with the reason.
    The limit and the fee are INFLX admin settings.
  - There is **no shopper wallet** (5.1).
- **Place order ₹X:** the prices are fixed from this moment (M8). An online payment has **15 minutes** to finish;
  meanwhile the items (and gifts) are held for her. If it doesn't finish, the hold ends and nothing is ordered.
- If a price, offer or stock changed since the bag, the review shows the change **before** she pays.

### 6.9 Order placed (O13)
- "Order placed" with each brand's parcel and its arrival date, the total, and the payment method.
- **Notifications:** the shopper gets order placed, shipped, out for delivery, delivered, cancelled and refund issued.
  The **brand** gets each new order. The **creator** gets "A sale through your post" (never who bought, 4.14).

### 6.10 Delivery
- **Free delivery at launch;** the brand bears it. A delivery fee (₹X below ₹Y per brand parcel) is an INFLX admin
  setting, **off** at launch.
- **The brand ships** and marks each parcel **Packed** and **Shipped** (with the courier name and tracking number),
  then **Out for delivery** and **Delivered**, as today. Courier booking (Shiprocket) comes later.

### 6.11 My orders and tracking (O14, O15)
- **My orders:** each item with its status, arrival date and **Track · Cancel · Need help**, newest first, with search
  and filters (status, time).
- **A deal is one (v1.20, founder 5 Oct 2026).** The items of a **set**, of a **bundle's set**, of a **buy-one-get-one
  pair**, and the items a **buy-more saving applied to**, are **one card** in My orders: the deal's words ("Any 3 for
  ₹2,999", "Buy 1 get 1"), its items, one status, what the deal cost. Tapping it opens **the deal's page**: every item
  with colour and size, what was paid for the deal, one timeline, the address, the post, and **one** button —
  **Cancel deal** before it ships, **Return deal** once delivered. A plain-discount item, an item bought alone (6.2),
  and a gift offer's items and gift each stay their own, as before. A filter or a search that matches one item of a
  deal brings the whole deal.
- **Statuses:** Confirmed → Packed → Shipped → Out for delivery → Delivered; or Cancelled.
- **Order detail:** the timeline with dates, the courier and tracking number once shipped, the address, the price
  paid for this item, the payment method, and the post it came from.

### 6.12 Cancelling (O16, O17)
- **She can cancel any item until the brand marks it Shipped.**
- **Reasons:** Incorrect size ordered · Not needed any more · Ordered by mistake · Want a different style or colour ·
  Delivery is taking too long · Found a better price · Other (write a note). A reason is required.
- **Deal items cancel together.** A BOGO pair, a bundle set, a set and a volume deal are cancelled as one: the screen
  is **Cancel deal** — the deal's words, who it is from, its items, the reason, and the refund of the whole deal, said
  once and up front (v1.20; before, it was opened from one item with the warning "This is part of a deal. Cancelling
  cancels N items together"). Nothing in the rule changed: they always went together.
- **A free gift follows what earned it.** If the cancel leaves the post's items below the gift's threshold, the gift
  is cancelled too.
- **The brand can cancel** an item it can't send (for example, out of stock), with a reason; the shopper is told and
  refunded the same way.
- **Refunds:**
  - **online payment:** refunded **automatically to the original payment method**, for the item's paid share (and the
    parcel's delivery fee if the whole parcel is cancelled). "Refund of ₹X to your UPI in 5–7 working days" shows in
    the order;
  - **cash on delivery:** nothing to refund ("A refund is not needed; this was pay on delivery").
- **Stock** of cancelled items (and gifts) goes back.
- **Money:** the creator's commission on cancelled items is taken back from her pending earnings, and the brand is not
  paid for them.
- **After Shipped**, cancelling is closed; she returns it once delivered (returns: next discussion).

### 6.13 Money for each item
- **Every item is its own money record:** the post, the creator's collaboration, the offer, the price paid, the
  creator's commission, the INFLX fee and what the brand receives.
- **Deal prices are shared out in proportion to each item's normal price.** Example: "Any 2 for ₹2,999" with items of
  ₹2,000 and ₹1,500 → ₹1,714 and ₹1,285. **BOGO:** the paid one carries the price and the free one ₹0, as she sees it (the pair cancels together). A volume ₹ reward is
  shared across the post's items the same way. **Gifts** carry no price and earn no commission.
- **Commission** = her collaboration's commission % × the item's paid share (M3), for each item (M2).
- **The INFLX fee** is worked out on the paid share, per category, as today. **What the brand receives** = paid share −
  commission − INFLX fee.
- **Channel:** each item records the channel of the last tap on that creator's links (4.14). Reporting only.

**How every rupee the shopper pays is split (founder, 30 Sep 2026: "divided clearly")**

What she pays for the items (after the deal) is split three ways, **for every item, at the moment she places the
order**, and each share is stored on the item with the rate that made it:

| Share | Who decides the rate | Worked on |
|---|---|---|
| **Creator's share** (commission) | **The collaboration** the creator signed with the brand (`commission_pct`, 2.x) | the item's paid share |
| **INFLX's share** (platform fee) | **INFLX admin**: the rate for the brand's business category for a sale through a creator's post (Admin → Pricing → Categories, the **Path B "via influencer"** column), or the brand's own rate when admin set one for that brand | the item's paid share |
| **Brand's share** | what is left | paid share − creator's share − INFLX's share |

Example, with today's settings: a fashion brand, a creator on 10%, the fashion Path B rate 5%. She pays
**₹1,000** for a kurta.

| | ₹ |
|---|---|
| Shopper pays for the item | **1,000.00** |
| Creator's share · 10% (her collaboration) | **100.00** |
| INFLX's share · 5% (admin, fashion Path B) | **50.00** |
| Brand's share | **850.00** |

- **The three always add up to what she paid**, to the paisa. Shares are worked in paise and rounded; any leftover
  paisa goes to the brand's share.
- **Rates are frozen on the item.** If admin changes the fashion rate tomorrow, or the brand and creator change terms,
  orders already placed keep the rates they were placed with.
- **Gifts and free items** (BOGO's free one) have a paid share of ₹0, so all three shares are ₹0.
- **Not part of the split:** the delivery fee (off at launch) and the cash-on-delivery fee go to the brand, which ships
  and collects. They earn no commission and no INFLX fee.
- **When each share is paid:** the creator's share waits in her pending earnings until the return window closes, then
  becomes withdrawable (TDS as set by admin is deducted when she withdraws: ₹100 → ₹90 at 10%). The brand's share is
  paid after the return window closes, less TCS when admin switches TCS on (1%: ₹8.50 of ₹850). INFLX keeps its share;
  the GST on INFLX's share is recorded for INFLX's own filing, as today.
- **Cash on delivery:** the brand's courier collects the cash, so the money is with the brand. The brand then **owes
  INFLX the creator's share + INFLX's share** (₹150 in the example). INFLX pays the creator from it as above, and the
  amount the brand owes is **taken from the brand's next online payouts**; what is still owed shows to the brand and
  to INFLX admin.
- **Cancelled (and later returned) items:** all three shares of that item are reversed: the creator's share leaves her
  pending earnings, INFLX takes no fee, the brand is not paid for it, and the shopper gets back what she paid for it.
- **Everyone sees their line:** the brand sees each item's paid amount, creator's share, INFLX's share and its own
  share; the creator sees her share per item (never who bought); INFLX admin sees all three for every item.
- **Payouts are unchanged (M9):** the commission waits in her pending earnings until the return window closes, then
  becomes withdrawable. The brand is paid after the return window closes (G-3), never for cancelled items.

### 6.14 Who sees what
- **Shopper:** her orders, statuses, refunds.
- **Brand:** each order for its products, with the items, sizes, the post and creator each came from, the address to
  ship to; it marks Packed, Shipped (courier, tracking), Out for delivery, Delivered, and can cancel with a reason.
- **Creator:** the sales through each of her posts (items, amounts, her commission, channel), **never who bought**.
- **INFLX admin:** everything, including the settings (COD limit, COD fee, delivery fee) and every order's money.

### 6.15 Not in this step
Exchanges (returns were added on 4 Oct — 6.16) · pay at store (O5) · courier booking and live tracking (Shiprocket) ·
invoices · a "pay now" nudge for cash-on-delivery orders · map-based addresses.

---

### 6.16 The return window, and returning an item (added 4 Oct, v1.18)

Founder, 4 Oct 2026. Contract `features/shopper-walk-fixes` (W11, W13, W14).

**One window, set by INFLX.**
- The return window is INFLX's: one number for the whole platform. No category, brand or product has its own.
- INFLX's admin sets it in **hours or days** (1 hour to 365 days) in one place: Admin › Money › Settings › Return window. It is 7 days now.
- A sale is stamped with the window in force when it is made. Changing the number never moves a sale already made.

**After delivery, everything follows that window.**
- The window runs **from the delivery**, for every order, paid online or in cash.
- Until it is delivered nothing is added to anyone. When the window closes — within the hour — the creator's commission is added to her wallet, the brand's money is added to its wallet, and INFLX's share counts as earned.
- This replaces item 17's rule for online orders (added once shipped, the window counted from the order). Cash on delivery already worked this way.
- A new agreement says it in the same unit: "After the 7-day return window", "After the 24-hour return window". A sent agreement keeps its words.

**Returning an item.**
- When: a delivered item, inside its window. Not before delivery; not after the window has closed.
- What: an item. A deal's items go back together and a gift follows what earned it — the same items a cancel takes (6.12).
- How: My orders → the item → Return → a reason (the size doesn't fit · it arrived damaged · it isn't as shown · I changed my mind · other, with a note) → confirm.
- Who decides: **INFLX** (Admin › Returns): approve, or reject with a note she is shown; then "refunded" once the item is back with the store. The brand sees the return and is told; it does not decide.
- While a return is open, that sale's three shares wait, even past the window.
- Refunded: the item is undone exactly as a cancelled item is (6.12, 6.13) — its stock goes back, the creator's commission leaves her pending earnings, INFLX's share is not taken, the brand is not paid for it. An online payment is refunded to where it came from. A cash-on-delivery order is paid back by INFLX by hand.
- Rejected: nothing changes; the shares are added when the window closes. One answer per item.

**One item of a deal is not right (v1.21, founder 5 Oct 2026).** A delivered deal's one button is **Return or replace**. It asks first: *One item is not right*, or *Return the whole deal* (the return above, with all five reasons).
- **One item** → which item, and what is wrong: **the size doesn't fit · it arrived damaged · it isn't as shown.** ("I changed my mind" is not here: for that the whole deal goes back, or she keeps it all. One piece never goes back at the deal's price for no reason.)
  - **The size doesn't fit** → another size of the same product that is in stock (the same or another colour; never another product) → **Request replacement**. No other size in stock → she keeps it, or returns the whole deal; there is no one-item refund for a size.
  - **Damaged, or not as shown** → the **same item again** when the store has one → Request replacement. She writes what is wrong.
  - …and the store has no more → **INFLX refunds only that item's share** (the part of the deal's price that item carried when she ordered) and she keeps the rest. Not for a buy-one-get-one pair: a pair goes back together.
- **A replacement moves no money.** The deal, what she paid, the creator's commission, INFLX's share and the brand's share stay as they were.
- **Who does what:** INFLX decides every request (Admin › Returns names its kind: Return · Replace · Refund one item). On approval the replacement is taken from stock; the **brand** brings it and collects the other item in one visit, **at its own cost** — the shopper is charged nothing and INFLX arranges no courier — and marks it sent, then delivered (Order Fulfillment). A one-item refund is collected and marked refunded like a return of that item.
- **One replacement per item.** If the replacement is wrong too: its share when it is damaged or not as shown, or the whole deal.
- **The clock:** while a request is open the sale's three shares wait. When a replacement is delivered, **the return window runs again from that delivery** for that sale, and the shares are added when it closes.
- **What comes back** returns to stock only when the reason was the size. A damaged item, or one not as shown, is not put back on sale.
- **Not accepted:** the deal stays as delivered; that item has had its answer; she may still return the whole deal while the window is open. A replacement that sells out before INFLX can approve it closes by itself, and she may choose again.
- An item in no deal (a plain discount, an item bought alone) is returned on its own, as before.

**In the bag, a deal made of fixed pieces stays whole** (the 30 Sep board's D11, now enforced).
- A set, a bundle (pick any, mix & match) and buy one get one: one group, one tick, no − 1 + and no Remove on a single item; Edit deal and Remove deal.
- A plain discount, buy more save more, and spend or buy for a gift keep − 1 +: buying more is the offer.

**After Add to bag** she stays shopping: a short vibration, the button reads "Go to bag" for about a second, then she is back exactly where she was. The bag icon with its count is on every page she browses.

## 7. Open items (owed by the founder)

| # | Item |
|---|---|
| O1 | Shoot-plan rules that gate post creation (4.1) |
| ~~O2~~ | ~~Post link and post code~~: answered 28 Sep (4.14); formats fixed at build 29 Sep (v1.6). |
| O3 | Discover rails: detailed design (4.12) |
| O4 | Shopper app screens: ~~post page~~ (F1–F13 locked 29 Sep); ~~cart, gift choice, bundle completion~~ (section 6, **locked 30 Sep**); filters remain with Discover (O9) |
| O5 | Pay at store (M10) |
| O6 | Margin floor (1.8), deferred |
| O7 | Offers on the phone: after the website (1.1) |
| O8 | ~~Checkout path, addresses~~: agreed 30 Sep (section 6). **Returns and exchanges**: next discussion |
| O9 | Discover: how admin designs it (5.13) |

---

## 8. Change log

| Date | Version | Change |
|---|---|---|
| 2026-09-28 | 1.0 | First version, from the founder's three documents and answers of 28 Sep. Includes the Gift items tab (1.7) and "a removed product leaves her posts" (1.10). Offer creation web screens locked. |
| 2026-09-28 | 1.1 | Creator terms screens locked. Added: ending an offer drops it from unsigned invitations (2.8); "All products without offers" frozen at sending (2.4); example earnings per offer and the four creator notices (2.11). |
| 2026-09-28 | 1.2 | Store links, post links, post codes, collection links (4.14) from the founder's "Post Code and Links" document plus 11 agreed points: five channels, code at approval, handle-change redirect, channel labelled per creator, removed-post page, brand "copy all codes", admin-only real source. Old offer code retired (2.10). Post drafts added (4.2). |
| 2026-09-28 | 1.3 | Follower link/code screens removed from the board; the code-search rule recorded (4.14). New: engagement on INFLX posts (views, likes, comments, shares, saves; comment rules) (4.15), and social media numbers scraped from the links the creator adds at going live (4.16). Rules marked as recommendations await the founder's lock of the Level 5 board. |
| 2026-09-28 | 1.4 | New section 5, the follower app: navigation (bag and search on top, Saved tab, no wallet), guests, city range from the 146 cities (no exact location), welcome, Home circles and feed, opening posts, Play, Saved remembering the post, creator and brand stores, search, the feed rules. Guests may now save (4.15 updated). |
| 2026-09-29 | 1.5 | Level 3 board locked with its five questions as recommended: no edits once approved, she can take a post down (4.8); what a sent-back post may change (4.8); limits 10 slides, 30 products, 90 s a clip (4.8); photo tags optional (4.8); collection editing and hiding (4.11). |
| 2026-09-29 | 1.6 | Level 4 board locked and built: the code's characters, a bare or unknown ending counts as Other, link previews aren't visits (4.14). Until the shopper app, a link opens a plain INFLX page (post, store or collection) with no shopping. |
| 2026-09-29 | 1.7 | Shopper app decisions: board F1–F13 locked; location is now the phone's current location, used and never stored, with the city as fallback (5.3, 5.4); no Add or bag until checkout (5.1); Discover shows "Coming soon" (5.13); video from INFLX storage at launch with four speed measures, Cloudflare Stream when load-pauses grow (4.7); engagement built in two halves (4.15); the feed written in full: Stage A on, Stage B built but off behind an admin switch with a readiness panel and a preview (5.12); what the app records (5.14). |
| 2026-09-30 | 1.8 | The new app build: the video player (plays only on screen; muted in feeds, sound setting in Play; preloads; 200 MB phone cache; stable, cacheable links for approved posts), video shrinking before upload with a safe fallback, links open in the shopper app only (incl. /c/), and what waits for the Play Store listing (app-link verification, the right post after install) (4.7, 4.14). |
| 2026-09-30 | 1.9 | New section 6, ordering, from the founder's ten agreed points and reference screens: every item remembers its post; bag grouped by post; one bag, one payment, one order per brand; size sheet; how each offer works in the bag (BOGO free choice, volume tiers, bundle sets with costliest first, fixed sets, gifts once per order, gifts run out → posts leave the shop); Buy now; bag states and tick boxes; guests sign in at Continue; manual addresses; review and pay (Razorpay, COD up to ₹5,000); price fixed at Place order with a 15-minute hold; free delivery at launch; statuses; cancelling until Shipped with deal items together and gifts following; automatic refunds; stock back; per-item money with deal prices shared by normal price; who sees what. Open items renumbered to 7, change log to 8. |
| 2026-09-30 | 1.10 | Founder's concern: a deal with 20 products and 10 gifts can't be built in a pop-up. **Every deal post now opens a full-screen deal page (6.5)**: the deal at the top, every product in a grid (filters and sort above 8), the size sheet per pick, a "Your picks" tray, a sticky progress bar, and a review. One page per kind of offer: free gift in two steps (buy, then choose from all gifts), bundle slots (mix & match with category tabs), fixed set as a list, volume tier ladder with steppers, BOGO product then pair. Bag deal groups get Edit deal. Screens D1–D11 replace O3–O5. |
| 2026-09-30 | 1.11 | Founder: concentrate on the deals. Tapping a product on a deal page opens the **product pop-up** there (photos, details, colours, sizes with stock, size chart, other choices) → Pick → closes → the card shows it picked; reopen to change or remove (6.5). The four deal types and every sub-type written as the shopper meets them (BOGO; volume by quantity % / ₹ and by value; bundle pick any / mix & match / fixed; free gift spend / buy X / one gift). Board: `features/shopper-ordering/04-preview/mockups/shopper-deals-mockups-v1.html`. |
| 2026-09-30 | 1.12 | **Final, locked by the founder.** One board for ordering and deals: `features/shopper-ordering/04-preview/mockups/shopper-ordering-mockups-final.html` (38 screens: O1, O2, D1, P1–P3, B1–B4, V1–V4, K1–K5, G1–G5, D4, D11, O6–O17); the deals board's screens replace D2, D3 and D5–D10. One-time check against the screens: screen references in 6.3–6.5 brought to the final names; the "Your picks" tray dropped (picks show on the cards, slots and pair list, and in the review); volume quantity is chosen in the pop-up, not a stepper on the card; BOGO is one pop-up in two parts; the volume example corrected to "save ₹900"; **rounding written down**: a % comes off each unit, rounded to the rupee; shared prices put any leftover rupee on the costliest item. |
| 2026-09-30 | 1.13 | Founder: every order's money divided clearly. 6.13 now shows how each rupee splits: creator's share at her collaboration's %, INFLX's share at the admin rate (category via creator, or the brand's own rate), the brand the rest; worked per item at Place order, frozen on the item, adding up to the paisa. Example ₹1,000 → ₹100 / ₹50 / ₹850 (fashion Path B 5%). BOGO wording aligned: the free one is ₹0 in the money too. Delivery and COD fees go to the brand. Cash on delivery: the brand owes creator's share + INFLX's share, taken from its next online payouts. |
| 2026-10-01 | 1.14 | Founder: a published offer needs "Add products", and products may change only while no creator has the offer. 1.10 rewritten: add and remove are allowed until the offer is given to a creator (an unsigned invitation counts), then both are greyed out with the reason; End offer now unchanged. This **reverses** v1.0's "a removed product leaves her posts": removal from an offer a creator has is no longer possible (2.8 row replaced). 1.4 and 1.12 aligned. Contract `features/offer-add-products`. |
| 2026-10-01 | 1.15 | Founder: **the posting date is the last day to go live, not the day itself.** A post is in the shop as soon as INFLX approves it; an offer post is visible only while its offer is active (it waits for the offer's start, leaves at its end) (2.1, 4.1, 4.14, 5.12). Offers a brand may give: start on or before the posting date and end at least one day after it — an offer ending on the posting date, or starting the day after it, is no longer given (2.3). Products without offers: free of offers from the day the terms are sent, not from the posting date (2.4). Unchanged: invitations close 3 days before the date; the date is at least 7 days ahead; the minimum is counted by the date; late and Delayed after it. Contract `features/posting-date-last-day`. |
| 2026-10-01 | 1.16 | Founder: the shopper's **Women / Men / Kids choice is a preference for ordering, never a filter** (5.12). Every live post is in her feed; the ones she shops for come first. Before, a shopper who chose only Women saw nothing while the one live post was a men's watch. Home circles and "more posts" follow the same rule. Contract `features/shop-for-preference`. |
| 2026-10-03 | 1.17 | Founder: **Delete in two places.** A **Draft** is deleted from the Offers list and erased. An **Ended** offer (ended early or by its date) is deleted from the Offers list or its own page and **removed from the brand's lists** (the list and its counts, its page, the creator-terms "not shown, ended" note, "last in offer …" on Products without offers; the days its products were held are freed); its record stays for the creators who had it, their posts, orders, payments and INFLX. A **Scheduled** or **Live** offer can't be deleted: end it first. 1.9 rewritten, 1.12 aligned (Delete on Draft and Ended rows and on an Ended offer's page). This **partly reverses** v1.0 §1.9 ("a published offer can't be deleted, only ended") and question 3 of the `features/offer-builder-v2` board O1 (drafts only), for ended offers, at the founder's request of 3 Oct. Contract `features/offer-delete`. |
| 2026-10-04 | 1.18 | Founder, from his walk of 3–4 Oct (contract `features/shopper-walk-fixes`, board locked 4 Oct). **The return window is INFLX's, one number for the whole platform, set by the admin in hours or days (7 days now); after delivery the creator's commission, INFLX's share and the brand's money all follow it** — this replaces item 17's rule for online orders (added once shipped, counted from the order); the money jobs run hourly; the per-category and per-product return numbers are no longer read. **A shopper can return a delivered item inside the window**; INFLX approves or rejects and marks it refunded; a deal goes back together; an open return holds the sale's shares (new 6.16). In the bag a set, a bundle and buy one get one stay whole (no − 1 + on one item). After Add to bag: vibration, "Go to bag" for a second, back where she was; the bag icon on every browsing page. A feed video opens full screen on a tap; the playing video switches the moment the swipe lands (5.5, 5.7 unchanged in words — the app now does what they say). "Products in this post" is a grid with a product page showing the listing's details; a discount post never shows "Build your deal"; the deal's sentence is said to the shopper. A video carries a picture taken from it on the creator's phone. |
| 2026-10-05 | 1.19 | Founder, 5 Oct 2026 (contract `features/shopper-deal-orders`, part C; board locked 5 Oct): **one item of an offer can be bought alone, at its normal price; the offer's price applies only when the offer is completed.** This **reverses** 6.5's "a deal item is never added alone" for bundles (pick any, mix & match), buy more save more and gift offers. **Not for buy one get one. A set stays whole unless its brand switches on "Pieces can also be bought alone"** — a new number of a Bundle · Fixed offer, off by default, set in the draft and frozen at publish like the others. The product page of an offer post has two choices ("Buy this alone · ₹X" with Buy now and Add to bag, and "In an offer: … · See offer ›"); the bag icon in "Products in this post" adds the product alone; in the bag an item bought alone is an ordinary row with a nudge, and **when her items from one post complete the offer it applies by itself**. A saved product opens its product page. 6.2, 6.3, 6.4, 6.5, 6.6. No change to what any deal costs, to commission, or to INFLX's share. |
| 2026-10-05 | 1.20 | Founder, 5 Oct 2026 (contract `features/shopper-deal-orders`, part A; board O1–O4): **My orders shows a deal as one.** A set, a bundle's set, a buy-one-get-one pair and the items a buy-more saving applied to are one card, one page, one **Cancel deal**, one **Return deal**; a plain-discount item, an item bought alone and a gift offer's items stay their own. 6.11, 6.12. Nothing about money, refunds or what cancels together changes — it is how the same orders are shown and named. ("Return or replace" comes with part B.) |
| 2026-10-05 | 1.21 | Founder, 5 Oct 2026 (contract `features/shopper-deal-orders`, part B; board R1–R10; migration 204): **one item of a delivered deal can be replaced, or — when the store is at fault and has no more — have only its share refunded.** "Return or replace" asks first whether one item is not right or the whole deal goes back. A size → another size in stock; damaged / not as shown → the same item again, else that item's share (never for a buy-one-get-one pair). A replacement moves no money; **the brand pays to bring it and take the other item back**; INFLX decides; the brand marks it sent, then delivered; **the return window runs again from the replacement's delivery**, and the sale's shares wait until it closes. One replacement per item. 6.16. A return of a whole deal, and every order with no such request, are unchanged. |
