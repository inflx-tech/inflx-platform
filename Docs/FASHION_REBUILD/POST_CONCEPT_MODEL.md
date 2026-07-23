# Post → Concept → Discover — Architecture Model

**Status:** LOCKED (architecture) · 2026-07-22 · discussion-only, no code
**Supersedes:** the product-first discovery model in `Docs/FOLLOWER_APP_MAP.md` and the authoring split in `AUTHORING_MODEL.md` (see §10)

---

## 1. The principle

The follower app's source of truth is **not products**. It is **creator Posts and Videos**.

Products are inventory. Posts are the catalogue. Every discovery surface — Global Home, Discover, Posts tab, Videos tab, Brand store, Creator store — is the same query over published posts, filtered differently.

```
Brand supplies products/offers → allocates to creator
        ↓
Creator publishes Post/Video under ONE concept, attaches products
        ↓
Post/Video = source of truth
        ↓
Discover navigates to posts, never to raw products
        ↓
Follower taps post → "Shop this post" → product popup → PDP → checkout
```

---

## 2. Actors

| Actor | Owns | Does NOT |
|---|---|---|
| **Brand** | Products, offers, campaigns, allocation (store / category / products / offers) | Never designs Discover. Never posts. Never approves posts. |
| **Creator** | Posts, Videos, product attachment, own store's Discover layout | Cannot invent concepts or collection names. |
| **Admin** | Concept vocabulary + rules, Collection vocabulary, Global Home Discover, the single Brand-store template, post approval | — |

Brand's journey ends at "allocate". That is the whole of the brand app for this model.

---

## 3. Concepts

A **Concept** is an admin-defined *named rule* that filters a product universe. It is never just a label.

Five families, and only five:

| # | Family | Binds | Example |
|---|---|---|---|
| 1 | Category | one shoppable category | Winter Jeans · Party Jeans · Office Kurtis |
| 2 | Price | price band only | Under ₹499 · Under ₹999 · Luxury Picks |
| 3 | Offer | offer type only | BOGO Picks · Volume Deals |
| 4 | Category + Price | both | Jeans Under ₹499 · Shoes Under ₹999 |
| 5 | Category + Offer | both | BOGO on Jeans · Volume Offers on Watches |

**Rules of the vocabulary**

- A concept binds to **exactly one** category. Mixed-category ideas are not concepts — they are Collections (§4).
- Concepts are **category-specific**: `Summer Jeans`, `Summer Shoes`, `Summer Kurtis`. Never a global `Summer Collection`.
- "Category" means an **actually shoppable product type** — jeans, t-shirts, kurtis, watches. **Not** men / women / topwear / bottomwear. Those are navigation abstractions and are excluded from concept binding.
  → *Schema implication:* `category_nodes` needs a `concept_eligible` boolean. Exact tree depth deferred.
- Offer concepts match the **offer type** (BOGO, volume, …), not one specific `brand_offers` row. Which brands' offers count is bounded by the scope the creator picks at step 1.
- Price rules read the **post-offer effective price**. A product qualifies if its **cheapest variant** qualifies.
- Concepts are **append-only**. Never edited, never retired once live. Admin adds new ones.

---

## 3.5 Concepts are TEMPLATE-generated, not hand-authored

*(Source: "Follower creator commerce.docx", 2026-07-22)*

Hand-authoring concepts for 195 leaves would mean managing thousands of rows. Instead the DB stores **templates**, and a concept is the pair `(template_id, category_node_id)`. The display name is generated.

**Taxonomy already exists in code:** `category_nodes` is Segment → Category → **Leaf**, exactly the three levels in the doc (Women → Western Wear → Jeans). **`is_leaf = true` IS the concept-eligible level** — no new `concept_eligible` column is needed after all. Segments and categories (Women/Men/Topwear/Bottomwear) are navigation and are excluded by construction.

**Category templates — 27, in 4 groups:**

| Group | Templates |
|---|---|
| Seasonal (4) | Summer · Winter · Monsoon · Spring `{Category}` |
| Occasion (9) | Office · Party · Wedding · Festive · College · Airport · Vacation · Date Night · Weekend `{Category}` |
| Style (9) | Minimal · Casual · Elegant · Classic · Trendy · Street Style · Korean Style · Boho · Vintage `{Category}` |
| Utility (5) | Everyday · Travel · Gym · Workwear · Lounge `{Category}` |

**Price templates — 9, global (not category-specific):** Under ₹299 / ₹499 / ₹799 / ₹999 / ₹1499 · Premium Picks · Luxury Picks · Budget Friendly · Best Value

**Offer templates — 11, global:** BOGO · Flat 20/30/40/50/60% · Buy 2 Get 1 · Volume Offers · Combo Deals · Flash Sale · Limited Time · Clearance

**Families 4 and 5 are generated cross-products:** `{Category} + {Price}` → "Jeans Under ₹499"; `{Category} + {Offer}` → "BOGO Jeans".

**Scale:** 47 templates + 195 leaves ⇒ ~9,200 addressable concepts, none of them stored as static rows. Adding "Resort `{Category}`" later makes it instantly available across all 195 leaves.

### ⚠ The seasonal/style templates carry no filter

`Winter Jeans` and `Summer Jeans` resolve to **the same product set** — all jeans in the creator's scope. The rule is the *category*; the template supplies *meaning and a discovery bucket*, not a filter. Differentiation happens at the post level: the creator declares which bucket their content belongs to, and their photos express the idea. Two creators may bucket near-identical posts differently, with no enforcement (this is how hashtags work, and it is acceptable).

**Consequence:** `tag_vocabulary` should be **kept, not retired** — attaching optional required-tags to a template (Winter → `winter`, `warm`) is the only available mechanism to give seasonal/occasion/style templates real filtering power. This reverses the tentative "retire tags" recommendation in `CONTROLS_MAP.md §1.4`.

---

## 4. Collections — the sixth family

Some creative ideas cannot be expressed as a category rule: an airport look is jeans + shoes + a bag + sunglasses.

A **Collection** is an admin-defined *name with no rule*. Admin publishes a comprehensive list (`Bali Style`, `Vacation Style`, `Airport Look`, `Coffee Date`, `Office Essentials`); the creator picks one. Creators do **not** free-type collection names — that keeps the vocabulary shared, so a global Collections surface aggregates cleanly across all creators instead of turning into 5,000 one-off names.

| | Concept | Collection |
|---|---|---|
| Named by | Admin | Admin |
| Has a product rule | Yes | No |
| Categories | Exactly one | Any mix |
| Product picker | Filtered to the rule | Whole allocated universe |
| Discoverable by rule | Yes | By name only |

At publish time a Collection **fully replaces** a Concept. A post has one or the other, never both.

---

## 5. Publishing a post (creator, 4 steps)

```
Step 1  SCOPE      single brand  |  multiple brands  |  entire collaborations
                   → defines the product universe (e.g. 100 / 500 / 1000 products)

Step 2  CONCEPT    pick one of the 5 families → one concept
        or         pick one Collection
                   → universe narrows to the matching products (e.g. 30 jeans)

Step 3  MEDIA      single image | image carousel | video | video carousel

Step 4  PRODUCTS   attach products, chosen only from the narrowed list
                   carousel: different products per slide, or the same set at different angles
```

Constraints:

- **One post = one concept, permanently.** No multi-tagging.
- **Concept is not editable after publish.** Want the same photos under another concept? Publish a second post. One upload = one post, exactly like Instagram.
- **No minimum or maximum** product count per post.
- ⚠ **"All attached products satisfy the concept" is CONTRADICTED by the founder's own reference screen** — see §5.5.

### 5.5 Image posts vs video posts — the Creator Studio mechanics

*(Source: "Follower app creator studio.docx", 2026-07-22)*

Images and videos are handled differently, deliberately, to avoid AI.

**Image post — steps 4-8**

4. **Post type:** Lifestyle Post (real photos, shoots, travel) or Editorial Shopping Post (Canva collage; INFLX template builder later). *Both are identical after upload — it is a label, not a different pipeline.*
5. **Upload image.** The image is a flat visual. No shopping information exists in it.
6. **Tag products.** Image opens fullscreen; creator taps a garment → bottom sheet of eligible products → pick one. Repeat per visible product. Backend stores only `(post_id, product_id, x%, y%)`. **Nothing is drawn into the image.**
7. **Preview tag style:** Soft Editorial · Minimal · Hidden Until Shop. The app renders the labels at runtime.
8. **Publish.**

**Video post — steps 4-6:** upload video → **check products from a list, no coordinates, no tagging, no AI** → publish. Products move; floating tags on video are a v2+ problem (AI object tracking, time-based highlights, scene shopping).

**Runtime rendering is the key property.** The follower's app loads `image + coordinates + current product data` and draws the tags live. If ₹799 becomes ₹699 tomorrow, the tag changes itself — **the creator never republishes.** This is the same principle as the eligibility model in §6: *the media is frozen, the commerce layer is live.*

**Follower shopping — two paths:**
- Tap a floating tag → small popup → product detail
- Tap `🛍 Shop this post (5)` → bottom sheet listing every tagged product
- Video: `🛍 Shop this video (4)` → bottom sheet only

### PARKED — concept purity vs outfit posts

⚠ *The reference screens are illustrative layout models only. Their products, prices and concept names are dummy content and are NOT evidence of a rule. An earlier version of this section wrongly cited them as a contradiction — withdrawn.*

The open question is real but independent of the mockups: an outfit post naturally mixes categories (jeans + shirt + bag), while §5 says every attached product must satisfy the concept. Today the answer is "mixed outfits go to Collections". If that proves too restrictive in practice, the fallback is:

**Anchor + supporting:**
- **≥1 anchor product must satisfy the concept.** The picker opens filtered to the concept.
- Remaining products may be attached from the creator's **full allocated scope** (a second, unfiltered tab in the picker).
- §6 eligibility then reads naturally: a post is live while **≥1 anchor** still satisfies the concept.

This matches the screen, keeps the banner's promise honest (the banner said Jeans Under ₹999 and there is a wide-leg denim at ₹999), makes the eligibility rule coherent, and removes the pressure to push every outfit post into Collections. **Needs founder ruling.**

---

## 6. Eligibility — the "promise" model

A concept is a promise made to the follower. Prices, offers and allocations change after publishing; the brand must never be restricted because a post exists.

All drift cases collapse into one live, per-product test evaluated at read time:

```
eligible(product) =
      still allocated to this creator          (brand didn't revoke)
  AND still published and in stock
  AND still satisfies the concept rule         (effective price / offer type / category)

post is visible   ⟺  eligible count ≥ 1
post goes dark    ⟺  eligible count = 0  → notify creator:
                       "Your post no longer matches the selected concept."
```

Worked example — concept `Winter Boots Under ₹999`:

| Product | Price now | Eligible |
|---|---|---|
| Boot A | ₹899 | ✅ |
| Boot B | ₹1099 (brand raised it) | ❌ |

Post stays live on the strength of Boot A. If Boot A also crosses ₹999, eligible = 0 and the post goes dark.

No schedulers, no snapshots, no back-dating. One code path covers price rises, offer expiry, revoked allocation and stock-outs.

**Ineligible-but-purchasable products** (price rose, but the item is still on sale) remain buyable inside *Shop this post*, sorted below the eligible ones — the price is on screen, so nobody is misled, and the sale isn't lost. Dead products (revoked / delisted / out of stock) are removed from the popup entirely.

---

## 7. Approval

```
Creator submits post  →  ADMIN approves  →  live
```

Brand approval is **not** in this path. (The three-step chain in `AUTHORING_MODEL.md` — creator → brand → admin — governed brand-hero product imagery, a different thing.)

*Operational note:* admin is now the single throughput gate on all creator publishing. Worth revisiting a trust-tier auto-approve once volume is real; not a launch blocker.

---

## 8. Discover authoring

Both creator and admin build Discover the same way, with the same tool:

```
Layout  →  Chips  →  Banners  →  attach a Concept (or Collection)
```

Zepto-inspired chip layout is the only style for v1.

Example: layout `Budget Friendly` → chips `299 · 499 · 699 · 999` → under chip `499`, banners like `Winter Jeans Under ₹499`.

**Banners are dynamic, not hand-picked.** A banner stores:

- a concept (or collection) reference
- a media filter — posts / videos / both
- an optional short list of **pinned** posts to show first

The backend fills the rest automatically from every matching published post. The author never edits the banner again, and it never goes stale when new posts arrive. Hand-picking was rejected: it doesn't survive admin curating across every creator on the platform.

**Who sees what**

| Builder | Content pool |
|---|---|
| Creator | Only their own posts/videos |
| Admin | All creators |

**Ordering and fallback:** rank → personalisation → location. If nothing matches at all, **hide the banner**. Never render an empty one.

---

## 9. Surfaces

| Surface | Built by | Content |
|---|---|---|
| **Global Home / Discover** | Admin | All creators' posts, via concept banners + ranking |
| **Posts tab** | — | Personalised post feed, no banners |
| **Videos tab** | — | Personalised video feed, no banners |
| **Creator store + its Discover** | That creator | Only their own content |
| **Brand store** | Admin (one template, reused for every brand) | **Only posts whose scope was that single brand** |
| **Collections surface** | Admin | Posts grouped by collection name, aggregated across creators |

**Brand-store scoping is deliberately strict.** Only single-brand-scoped posts appear. Rationale: brands commission specific posts offline, often handing the creator the concept list. A multi-brand post still earns that brand sales — it just doesn't occupy their store.

**Purchase path**

```
Discover → banner → posts → Shop this post → product popup → PDP → checkout
Videos   → Shop this video → product popup → PDP → checkout
```

---

## 10. What this retires

- **Product-first Discover.** Sections that surface raw products as the entry point are replaced by post surfaces.
- **`AUTHORING_MODEL.md`'s "creator never builds layout"** — the creator now builds the Discover layout inside their own store. Admin still owns Global Home and the Brand-store template.
- **The 3-step brand→admin approval chain for posts** (§7).
- **The 37-screen page map and the 18 admin section blocks** — drawn for a product-first Home. Carry no baggage forward; the founder will supply every screen fresh.
- **The existing follower app's screens, flows, colours, cart/bag journey** — full redesign, nothing reused.

Backend engines (listing, offers, commission, transactions, allocation) are unaffected and still stand.

---

## 11. Schema implications (proposed, not built)

New objects this model requires:

- `concepts` — family (1-5), name, `category_node_id?`, price rule, offer type, active
- `collections` — admin vocabulary, name, active
- `concept_templates` — family (category/price/offer), group (seasonal/occasion/style/utility), name pattern, optional required tags, price band, offer type
- `concepts` — `(template_id, category_node_id)` pair; name generated, not stored
- `creator_posts` — creator, scope (single/multi/all) + scoped brand ids, `concept_id` XOR `collection_id`, post type (lifestyle/editorial), media kind (image/video), tag style (soft_editorial/minimal/hidden), status (submitted/approved/live/dark)
- `post_media` — ordered slides, image or video, per-slide r2 key
- `post_products` — post ↔ product ↔ slide, `x_pct`, `y_pct` (null for video), `is_anchor`
- `discover_layouts` / `discover_chips` / `discover_banners` — owner (admin or creator), concept-or-collection ref, media filter, pinned post ids

Extends existing: `category_nodes.concept_eligible`; creator↔product allocation already exists via campaigns + `influencer_store_inventory`; `lookbook_products` is the seed for Collections.

---

## 12. Open

- Exact category-tree depth that counts as `concept_eligible`.
- Ranking and personalisation inputs (deferred by agreement).
- Trust-tier auto-approve for high-volume creators.
- Full screen list — founder to supply, one screen at a time.
