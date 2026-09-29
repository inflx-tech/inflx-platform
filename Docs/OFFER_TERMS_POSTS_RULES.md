# INFLX business rules — Offers, Creator terms, Shoppable posts

**Version 1.7 · 29 September 2026 · living document**

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
- The pool is **frozen when the offer is published**.
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

### 1.9 Status and deleting
- **Draft** (not published, locks nothing) → **Scheduled** (published, start date not reached) →
  **Live** → **Ended**.
- Drafts can be deleted. A published offer can't be deleted, only **ended**, so sales history and
  creators' records stay intact.

### 1.10 Changing a live offer
Creators' posts already promise the deal. So once published, **only two changes are allowed**:

| Change | What happens |
|---|---|
| **Remove products** | They leave every post using them. A post left with no products is **removed from the shop**. The same products leave creators' collections. Creators are notified. Products are freed immediately. |
| **End offer now** | Every post using the offer is **removed from the shop**, creators are notified, and all products are freed. |

Name, type, numbers, pool additions and dates can't be changed. To change the deal, end the offer and
build a new one. **Shoppers who have already started paying keep the old price.**

### 1.11 A product's price changes while it's live
1. Before saving, the brand sees a warning: which offer and posts the product is in, what the shopper
   will now pay, which price band the posts move to, and any bundle rule the new price breaks.
2. Nothing is blocked. The brand confirms or cancels.
3. After saving, each affected creator is told the old and new price.
4. Posts' price bands recalculate automatically (4.6).
5. Shoppers who have already started paying keep the old price.

### 1.12 Brand screens for offers (website, Listings)
- **Offers:** list with search, filters (type, status, dates), products count, creators count.
- **Products without offers:** every published product not in any offer on a chosen date, with its next offer if one is scheduled.
- **Products:** an **Offer** column and a product panel showing the current offer (until when) and next offer.
- **Gift items:** the gift-only list (1.7).
- **Offer page:** the deal, pool, creators given it, their posts and sales, plus "Remove products" and "End offer now".

### 1.13 Removed from the old offer engine
Whole-store offers · "Publish to store" and the store-direct path · "Pay at store / Online / Pre-book"
choices on an offer · the special offer inside creator terms · "Save to my offers" from terms · copying
an offer onto an invitation · the bulk "Attach offer" action in the product list · old offer shapes
(clean break; existing offers archived, test data).

---

## 2. Creator terms in a collaboration

### 2.1 Posting date and the join window
- The **posting date** is the day the set's creators go live on social media. It's set on the set.
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
- **Only offers valid on the posting date or the day after are shown.** Example, posting 10 Oct:
  - an offer running 1–31 Oct → shown (valid on the 10th);
  - an offer starting 15 Oct → not shown;
  - an offer that ended 5 Oct → not shown.
- Each row shows the name, type, product count and dates.
- 🟡 If an offer ends within 7 days after the posting date, the brand sees a warning: *"This offer ends
  20 Oct, only 5 days after posting. When it ends, her posts using it are removed from the shop."*
- Offers are **linked, not copied**. The same offer can go to many creators, and one creator can get
  many offers of any types.

### 2.4 What she can sell, part 2: products without offers
- Choices: **None** · **All products without offers** · **Choose products** (the same pool builder:
  category → all / filters / search).
- Only products **not held by any offer on or after the posting date** appear. Jeans whose offer ended
  5 Oct can be given for a 10 Oct posting.
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
| Brand removes products from an offer | Those products leave her posts and collections. A post left empty is removed. She is notified. |
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
- Posts go live from the posting date.
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
- Playing videos, shrinking them on upload and opening links in the app need the **next Play Store
  build**. Until a phone has it, a video shows its product's photo with "Update INFLX to play videos".
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
- **They appear the moment INFLX approves the post.** Before the posting date, a tap shows "This post goes
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
- Opening the app from a link, and opening the right post after install, need the **next Play Store
  build** (not an over-the-air update). The web page and search are built with the shopper app.

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
- **Until checkout is designed (v1.7):** there is no Add and no bag. Shop this post shows the products
  with the offer applied and a heart to save each one. The bag icon, Add and "Go to bag" arrive with the
  checkout discussion (O8).

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

**What can appear.** Live posts only: approved, posting date reached, not removed, at least one product
in stock and on sale. Filtered to her **Women / Men / Kids** choice (none chosen = everything). Play takes
videos only.

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

## 6. Open items (owed by the founder)

| # | Item |
|---|---|
| O1 | Shoot-plan rules that gate post creation (4.1) |
| ~~O2~~ | ~~Post link and post code~~: answered 28 Sep (4.14); formats fixed at build 29 Sep (v1.6). |
| O3 | Discover rails: detailed design (4.12) |
| O4 | Shopper app screens: ~~post page~~ (F1–F13 locked 29 Sep); filters, cart, gift choice and bundle completion come with checkout |
| O5 | Pay at store (M10) |
| O6 | Margin floor (1.8), deferred |
| O7 | Offers on the phone: after the website (1.1) |
| O8 | Checkout path, returns, addresses in the follower app (5.1): next discussion |
| O9 | Discover: how admin designs it (5.13) |

---

## 7. Change log

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
