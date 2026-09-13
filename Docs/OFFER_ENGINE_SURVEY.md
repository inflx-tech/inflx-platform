# Offer engine — what it can actually do today (read-only survey, 12 September 2026)

For the item 5 mockups. Question answered: what can a brand realistically attach to one creator's
terms inside a set? Nothing was changed. Every claim carries a `file:line` under `backend/`,
`Packages/brand-web/` or `Packages/Mobile/`, re-read against the working tree.

**In one paragraph.** There is one real offer engine, and it works. Five offer types, one library table,
a validator shared by the library and the per-creator path, one resolver that picks the single best
offer for a basket, and money that is computed on the discounted price. A brand can attach either a
library offer or a bespoke one to a creator's terms today, through the invite endpoint, and the discount
does reach the shopper's checkout. What is missing is around the edges: no phone or website screen can
attach an offer any more, the sale never records which library offer it came from, an offer's start date
is not enforced, and the shopper app itself has no shopping screens at the moment. Production has two
library offers, both plain store-wide percentage discounts, attached to nobody and never used.

---

## 1. Tables

### 1.1 `brand_offers` — the library
Created by `migrations/084_offer_engine.sql:24-41`; never altered since (grepped all 180 migrations).

| Column | Type | Null | Default | Constraint |
|---|---|---|---|---|
| `id` | uuid | no | generated | PK |
| `brand_id` | uuid | no | | FK brands, cascade |
| `name` | varchar(150) | no | | |
| `offer_type` | text | no | | CHECK in `discount, volume, bogo, bundle, free_gift` (`084:28-29`) |
| `offer_config_json` | jsonb | no | | the whole shape, including scope and products |
| `availing_modes` | text[] | no | `{pay_at_store,online_order}` | no CHECK |
| `status` | text | no | `draft` | CHECK in `draft, active, archived` |
| `published_to_store` | boolean | no | false | |
| `store_starts_at`, `store_ends_at` | timestamptz | yes | | the store-channel window |
| `created_at`, `updated_at` | timestamptz | no | now() | |

One index, `(brand_id, status)` (`084:43-44`). **Not on this table:** branch, category, product,
campaign, set or creator columns; no usage limit; no private or bespoke flag. Product scope lives inside
`offer_config_json`; there is no join table (`controllers/brandOffer.controller.js:176-177`).

### 1.2 `campaign_offers` — legacy, empty
`migrations/001_initial_schema.sql:327-339`: `campaign_id` (not null), `set_id` (nullable), `offer_type`
as the old enum `flat, percentage, bogo, bundle, volume, prebook` (`001:35`), `discount_value`,
`products_json`, `availing_modes`, `bundle_price`, `volume_threshold`, `prebook_advance`, `is_active`.
One create endpoint survives, no list or update. Production holds **zero rows**. Migration 090 already
records that fact (`090_home_stories_listing.sql:6-7`).

### 1.3 `campaign_influencers` — where an offer meets a creator
| Column | Meaning | Origin |
|---|---|---|
| `offer_type`, `offer_config_json` | the offer this creator carries, a **snapshot** whether it came from the library or was typed inline | `002:20-21` |
| `brand_offer_id` | which library row it was copied from; FK, set null on delete | `084:51-52` |
| `allocation` | `commissioned` or `promotional`, derived from the set's Aim | `084:58-60` |
| `promoted_brand_offer_ids` | uuid[] for the engagement multi-select | `086:16-17` |
| `alloc_scope`, `alloc_category_node_id`, `alloc_category`, `alloc_product_ids` | what she may **sell** (a separate axis from what the offer discounts) | `148:60-67` |
| `offer_valid_from`, `offer_valid_until` | her own window for the offer | `162:28-29`, `148:91-92` |
| `coupon_code` | unique, recorded on the sale, never priced | `001:248`, `002:35-42` |
| `offer_expires_at` | the invitation-acceptance clock, not a discount deadline | `001:250`, `148:84-90` |

`offer_type` has no CHECK on purpose (`147:21-27`); the validator guards writes.

### 1.4 `follower_transactions` — the sale
`offer_id` → legacy `campaign_offers` (`001:402`), `brand_offer_id` → library (`085:20-21`),
`offer_source` CHECK `influencer | store`, default `influencer` (`085:23-25`), `discount_amount`,
`coupon_code_used`, `offer_type`, `influencer_commission`.

### 1.5 The four vocabularies
DB enum for `campaign_offers`: `flat, percentage, bogo, bundle, volume, prebook`. DB CHECK for
`brand_offers`: `discount, volume, bogo, bundle, free_gift`. Code canon: the same five
(`services/offerConfig.validator.js:35`), with `flat`/`percentage` mapped to `discount` (`:50-61`).
`prebook` is deliberately not an offer type: "an availing MODE, not an offer mechanic" (`:44-48`), and it
prices to zero (`services/offer.service.js:416`).

---

## 2. Offer types and fields

Validator `services/offerConfig.validator.js`, entry `validateOfferConfig` (`:262-297`), never throws.

| Type | Mandatory fields | Optional | Lines |
|---|---|---|---|
| **discount** | `sub_type` `pct` or `flat`; `value` > 0 (≤ 100 for pct) | `scope` `store` / `category` / `products`; `category` or `category_node_id` (required when scope is category); `products[]` (required, non-empty, when scope is products) | `:164-175` |
| **volume** | `tiers[]` non-empty, each `pct_off` > 0 ≤ 100 with `min_spend` > 0, or `min_qty` > 0 when `mode: 'quantity'` | same scope block as discount | `:176-197` |
| **bogo** (same product) | `product.id`; `buy_qty` and `free_qty` default to 1 | | `:201-212` |
| **bogo** (old pair) | `buy_product.id`, `get_product.id` | | `:213-220` |
| **bundle** | `products[]` with at least two ids; `bundle_price` > 0 | | `:222-231` |
| **free_gift** | `offers[]` non-empty, each with `main.id` and `gift.id` | | `:232-246` |

Rules applied to every type on create and update: every product id must belong to the brand
(`:274-283`); every referenced product must be pushed to the store, else a 422 naming them (`:284-294`);
`availing_modes`, if sent, must be a subset of `pay_at_store, online_order, prebook, enquiry`
(`:299-310`). Note that `availing_modes` is **never enforced at checkout**: every use is a CRUD or display
site. It is a label.

### Scope: the audit's claim is confirmed
Scope machinery lives in `services/offer.service.js`: `resolveScope` (`:102-106`) and
`filterItemsByScope` (`:112-139`), which handles store, an explicit product list, and a category by
walking each product's node path with a legacy section-string fallback.

| Type | Resolver | Uses the scope machinery? | Verdict |
|---|---|---|---|
| discount | `resolveDiscount` `:141-208` | yes (`:144`, `:176`) | honoured, and refuses a non-store scope on a bill-only pay-at-store basket (`:151-159`) |
| volume | `resolveVolume` `:210-267` | yes (`:212-213`) | honoured |
| bogo | `resolveBogo` `:269` | **no**, the function does not even take `productMetaMap` | ignored |
| bundle | `resolveBundle` `:334` | **no** | ignored |
| free_gift | `resolveFreeGift` `:368` | **no** | ignored |

For the last three the enumerated products **are** the scope. A `scope`, `category` or
`category_node_id` key written into their config has no effect and is not rejected at write time. The
display layer works around exactly this (`services/offerDisplay.sql.js:76-94`), and the bulk product
attach refuses those three types for the same reason (`services/listingBulkActions.service.js:118-151`).

**Store or branch scope does not exist.** No branch column on the library, no branch filter in any
resolver. An offer is either brand-wide, a category, or a product list.

### Validity, limits, stacking, money
- **Library window** `store_starts_at`/`store_ends_at` is enforced for the store channel
  (`services/offerResolution.service.js:71-82`; `controllers/transaction.controller.js:565-583`).
- **Creator window:** `offer_valid_until` is enforced (`offerResolution.service.js:101-103`).
  **`offer_valid_from` is not enforced anywhere.** The tracking query does not select it
  (`services/transaction.service.js:147-157`). A creator offer with a future start discounts immediately.
- **Usage limits: none.** No per-shopper cap, no total cap, no minimum order, no redemption counter.
- **Stacking: never.** One best offer per checkout, scored against the whole cart, ties to the creator's
  own offer (`offerResolution.service.js:20`, `:151-192`). Candidates are the creator's snapshot plus any
  published library offers. No coupon discount exists; the coupon is only recorded on the row.
- **Money: commission on the discounted price.** Online order
  `influencerCommission = discountedItems × pct` (`transaction.controller.js:1403-1409`); pay-at-store the
  same on the net bill (`:373-381`); the platform fee also on the post-discount base (`:1412-1420`).
  Settlement consumes the stored numbers and does not re-derive from gross
  (`services/settlement.service.js:81-107`).

---

## 3. Who creates them today

### The brand website: one builder, mounted in two places
Form `components/OfferBuilder.js`, shell `app/dashboard/products/components/OffersLibrary.js`, shown as
the Offers tab of `/dashboard/products` (`products/page.js:735-740, 931-937`) and of
`/dashboard/products/listing` (`listing/page.js:616-621`). `/dashboard/offers` is a redirect
(`app/dashboard/offers/page.js:10`).

It collects: name (the only client-required field, `OffersLibrary.js:82`), type, discount sub-type and
value (flat only when scope is products, `OfferBuilder.js:311-324`), scope with a category tree or a
product finder (`:222-286`), volume mode and tiers (`:332-355`), same-product BOGO (`:363-367`), bundle
products and price (`:377-378`), free-gift pairs (`:387-399`), availing modes (`:405-415`), publish
toggle and store dates (`OffersLibrary.js:201-214`). It does **not** collect usage limits or a creator or
campaign to attach to.

It writes `POST /brands/me/offers` then `PATCH /brands/me/offers/:id` for status and publish
(`OffersLibrary.js:80-110`). A second surface bulk-attaches products to an existing discount or volume
offer (`InventoryBrowser.js:231`).

**No website screen attaches an offer to a creator or a set any more.** The only invite call carries
just `{ influencer_id }` (`app/dashboard/influencers/[id]/page.js:222`) and item 4 switched that button
off. The wizard route those pages mention no longer exists.

### APIs a phone app can call
All under `/v1/brands/me` (`routes/index.js:237`), brand role:

| Endpoint | Purpose | Controller |
|---|---|---|
| `GET /offers?status=&type=&q=` | library list with `attached_count` and counts per status | `brandOffer.controller.js:41-71` |
| `POST /offers` | create `{name, offer_type, offer_config_json, availing_modes?, store_starts_at?, store_ends_at?}` | `:80-124` |
| `GET /offers/:id` | one offer | `:127-137` |
| `PATCH /offers/:id` | edit config, status, publish, dates; type is immutable | `:240-304` |
| `DELETE /offers/:id` | archive, never hard delete | `:308-320` |
| `GET /offers/:id/attachments` | every creator row carrying it | `:143-169` |
| `POST /offers/:id/products` | bulk product attach (discount and volume only) | `:182-235` |
| `POST /campaigns/preview-basket` | what a shopper pays for a basket under an offer, unsaved offers allowed | `campaign.controller.js:1741-1817` |

### Bespoke or library? Both, but only one is stored as an offer
The attach path is `resolveOfferAttachment` (`campaign.controller.js:981-1027`), reached through
`POST /campaigns/:id/sets/:sid/invite` and `PATCH …/influencers/:ciId`:

- **Library:** send `brand_offer_id`. The server checks it is yours and not archived, then **copies**
  `offer_type` and `offer_config_json` onto the creator row (`:1003-1005`). Later library edits never
  change a live attachment.
- **Bespoke:** send `offer_type` and `offer_config_json` directly. It goes through the same validator as
  the library (`:1017-1022`), is stored only on `campaign_influencers`, is per creator, is not reusable,
  and never appears in `GET /brands/me/offers`.

There is no set-level or campaign-level offer column (`services/publishGate.service.js:82`), and no
"library offer visible to one campaign only". `allocation` is derived from the set's Aim: engagement
gives `promotional`, the rest `commissioned` (`:1025`). Promotional creators cannot carry a commission or
coupon (`:1267-1272`).

### The phone
The brand app's offer components survive but nothing reaches them (verified by import grep):
`components/brand/OfferBuilderSheet.js` (all five types, a real validity window, and an `inline` mode
that returns a config without saving a library row, `:141-152`), `components/brand/CreatorOfferSheet.js`
(pick from the library or build bespoke, plus her own `offer_valid_from`/`until`, `:120-153`),
`utils/offerBuilders.js` (pure config builders kept in parity with the web form by
`utils/__tests__/offerParity.test.js`), and `utils/campaignDraft.js` whose `invitePayload` already writes
`brand_offer_id` or the inline pair plus the window (`:271-320`). `api.js` already has `getOffers`,
`createOffer`, `updateOffer`, `getOfferAttachments` and `inviteInfluencer` (`:395-399`, `:337`), none
called from a live screen. Commit `5e04e1c` deleted `BrandOffersLibraryScreen.js` and two tests; they are
recoverable with `git show 5e04e1c^:…`.

---

## 4. Who applies them

### Where the discount is computed
| Entry | Inputs | Resolver | Lines |
|---|---|---|---|
| `POST /follower/pay-at-store` | campaign, set, creator row, bill amount | `computeOfferDiscount` → `resolveBestOffer` | `transaction.controller.js:302-364` |
| `POST /follower/orders` | per-brand group with items and tracking ids, or `brand_offer_id` for a store-direct group | `resolveBestOffer` with product metadata when creator-mediated | `:1367-1396` |
| `POST /follower/cart/price` | the cart, for a preview | `resolveOfferDiscount` directly (see gap 3) | `:1494-1551` |
| `POST /follower/store-offer/pay` and `/verify` | store-direct purchase, no creator, commission zero | `computeOfferDiscount` on a synthesised record | `:586-720` |

The result is `{discount_amount, applied_to, reason, adjustments?, offer_source, offer_id}`
(`offerResolution.service.js:200-212`); the loser offers come back with their reasons, which is what lets a
preview say "not applied, needs 3 items".

### What the shopper sees
Today, nothing: the follower app is profile-only (`Packages/Mobile/src/navigation/FollowerNavigator.js:22-27`)
and there is no web storefront. The display components survive unreferenced (`components/OfferCard.js`,
`OfferBlock.js`, `cards/ProductCard.js:44-47`) and the APIs that would feed them exist with no caller
(`api.js:769-779` for the creator-origin store, `:782` and `:834-835` for the store-direct path,
`:852` for the cart preview).

### Does a creator-attached offer reach the shopper end to end?
**The money does. The record does not.** The tracking query selects the creator's `offer_type`,
`offer_config_json`, `alloc_scope` and `offer_valid_until` (`transaction.service.js:147-157`); the
resolver scores that snapshot and the discount is charged. But:

1. **The sale never records which library offer it was.** The tracking query does not select
   `ci.brand_offer_id`, so the creator candidate's `offer_id` is always null, and the row is written with
   `brand_offer_id: null` and `offer_source: 'influencer'` (`transaction.controller.js:1462-1463`). Migration
   085 added the column for exactly this. You cannot answer "which offer produced this sale".
2. **`offer_valid_from` is dead at runtime** (§2).
3. **The cart preview disagrees with checkout.** `/follower/cart/price` scores only the resolved single
   offer (`:1524-1529`) while `/follower/orders` scores the creator's offer against published library
   offers too (`:1380-1384`). A published store offer can win at checkout and be absent from the preview.
4. **`promoted_brand_offer_ids` never reaches pricing.** Read only by the library's "where used" view and
   a feed adapter; a promoted offer discounts a basket only if it is also published to the store.
5. **Saved offers point at the empty legacy table.** `follower_saved_offers.offer_id` references
   `campaign_offers` (`011:19`), so a library deal cannot be saved.

---

## 5. Production data (read 12 September 2026)

| | Count |
|---|---|
| Library offers (`brand_offers`) | **2**, both `discount`, `sub_type: pct` (3% and 10%), scope `store`, status `active`, not published to the store, no dates, availing modes pay-at-store and online |
| Brands with an offer | 2 |
| Legacy `campaign_offers` | 0 |
| Creator rows (`campaign_influencers`) | 8 |
| of which carrying a library offer, a promoted list, or an inline offer | **0, 0, 0** |
| of which with an allocation | 0 (6 have a selling scope, 5 store and 1 category) |
| Coupon codes, offer windows on creators | 0, 0, 0 |
| Sales (`follower_transactions`) | 16, all `offer_source: influencer`, **none** with a `brand_offer_id` or a legacy `offer_id` |
| Distinct offers ever used in a sale | **0** |

No offer has ever been attached to a creator or applied to a sale in production. The engine is real, its
data is empty.

---

## 6. Recommendation

**Reuse the engine. Build only the two doors the phone lacks.** Everything below the surface already
exists once: the library table, the validator that both paths share, the snapshot-on-attach rule, the
resolver, the preview endpoint, and the pure-JS builder and creator sheet in the brand app. The wrong move
would be a second offer model on the creator's terms screen.

### (a) Pick an existing offer for one creator
Smallest sensible version, for item 5's terms screen:

1. A "Use a saved offer" row that opens a picker over `GET /brands/me/offers?status=active`
   (`brandOffer.controller.js:41-71`). Show name, type, and a one-line summary (the web builder's summary
   logic is reusable, and `utils/offerBuilders.js` already exists on the phone).
2. On save, send `brand_offer_id` in the invite body. The server snapshots the type and config
   (`campaign.controller.js:1003-1005`). Nothing to build on the server.
3. Show the result with `POST /campaigns/preview-basket` (`:1741-1817`): pick three of the brand's
   products and print "shopper pays / creator earns". This is the honest way to show a brand what the
   offer means before an invitation goes out, and it already exists.
4. Recover `CreatorOfferSheet.js` as the starting point: it already does the library pick, the bespoke
   branch, and the creator's window (`:120-153`). Restyle to the item 2 tokens like `DateField` was.

To build: one picker sheet (or the recovered one), the invite body fields, tests. Half a day.

### (b) A special offer for one creator inside her terms
Use the **bespoke inline path that already exists**: `offer_type` + `offer_config_json` on the invite,
validated by the same validator, stored on the creator row only (`campaign.controller.js:1010-1022`).

1. Recover `OfferBuilderSheet.js` and use its `inline` mode (`:141-152`), which returns a config without
   creating a library row. That is precisely the bespoke behaviour you want, and it is already written
   with all five types and product and category pickers.
2. Keep bespoke to the two scope-aware types by default, **discount** and **volume**, plus same-product
   **BOGO**. Bundle and free gift need multi-product picking and are heavy for a phone terms screen; the
   library remains the place to build those.
3. Offer a "save to library too" tick. If ticked, call `POST /brands/me/offers` first, then attach by id;
   if not, send inline. Both are one line of difference in `invitePayload` (`utils/campaignDraft.js:271-320`).

To build: recover and restyle two sheets, wire `invitePayload`, tests. One to two days including (a).

### Do these small server fixes with item 5, because the terms screen will expose them
- **Record the offer on the sale.** Select `ci.brand_offer_id` in `validateTracking`
  (`transaction.service.js:147-157`) and write it through at `transaction.controller.js:1462-1463`. Two
  lines. Without it, the brand's "where is this offer used" view can never show sales.
- **Enforce `offer_valid_from`.** One condition in `creatorOfferExpired`
  (`offerResolution.service.js:101-103`) and one column in the two queries that feed it.
- **Make the cart preview use `scoreAllCandidates`** so it cannot disagree with checkout
  (`transaction.controller.js:1524-1529`).

### Advise against
- **A per-set or per-campaign offer.** The rules doc puts money and delivery terms on the creator, and the
  code agrees: there is no set-level offer column and the whole resolver keys off the creator row. Do not
  add one.
- **Usage limits or stacking** in item 5. Neither exists in the engine; adding them touches checkout,
  settlement and reporting and belongs to the money items, not to terms.
- **Branch-scoped offers.** No column, no resolver support, and a Store Visit set already names a branch
  for the shoot, not for pricing. Leave scope as store, category or products.
- **Writing scope onto bogo, bundle or free gift.** It is silently ignored (§2). If the terms screen ever
  shows a scope control, hide it for those three types, as the web builder already does.
- **Expecting the shopper to see any of this soon.** The follower app has no shopping screens today; the
  discount will be charged correctly at checkout when those screens return, but a brand cannot be shown a
  live shopper view in item 5.
