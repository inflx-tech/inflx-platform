# Batch B — offers: parity with web, a validity window, and per creator

**The founder, 2026-08-27:** *"we concentrate on offers, it should be very clear like what we
have in web ... it should also have start and end date for that one where offer valid period
should also taken into consideration. pls complete all pending things clearly."*

---

## 1. What is actually true today — surveyed, not remembered

Every line below was read from the file named, or run read-only against **production** on
2026-08-27.

### 1.1 The live defect

```js
// Packages/Mobile/src/utils/offerBuilders.js
export function buildDiscount({ subType, value }) { … return { ok: true, config: { …, scope: 'store' } }; }  // :16
export function buildVolume({ mode, tiers })    { … return { ok: true, config: { …, scope: 'store' } }; }  // :35
```

**Two places, both hardcoded.** Every discount and every volume offer built on a phone applies
to the **whole store**, whatever the brand intended.

Production holds **2 offers in total**, both `discount`, and **both are `scope: 'store'`** —
including one named *"Yoy"* at 3%. There is no way to tell from the data whether that was
intended or imposed.

### 1.2 What the phone's builder is missing against web

| | Web `OfferBuilder.js` | Phone `OfferBuilderSheet.js` |
|---|---|---|
| discount · volume · bogo · bundle | ✅ | ✅ |
| **free_gift** | ✅ | ❌ absent |
| **scope** — store / category / products | ✅ on discount and volume | ❌ hardcoded |
| **availing_modes** — where it redeems | ✅ four modes | ❌ **zero mentions in the file** |
| applicability warning (a paper bill cannot honour a product-scoped offer) | ✅ | ❌ absent |
| **validity window** | ❌ **also absent on web** | ❌ absent |

⚠️ Omitting `availing_modes` is not neutral. `createOffer` deliberately drops the column so the
`NOT NULL DEFAULT '{pay_at_store,online_order}'` applies — so a phone-made offer silently
becomes redeemable **both** ways. That is why both production offers carry both modes.

### 1.3 The validity window already exists, is enforced, and has no way in

`brand_offers.store_starts_at` and `store_ends_at`:

* **Accepted** by `PATCH /brands/me/offers/:id` (`brandOffer.controller.js:268–272`)
* **Enforced at checkout**, both ends (`transaction.controller.js:580–581`) —
  `if (o.store_starts_at && … > now) throw UNAVAILABLE;` and the same for the end
* **Shown to shoppers** (`follower.controller.js:1559` returns `store_ends_at`)
* **Set by nothing.** No screen on web, none on the phone
* **Never used.** 0 of 2 offers carry a start or an end

⚠️ And `POST /brands/me/offers` does **not** accept them at all — its body is
`{ name, offer_type, offer_config_json, availing_modes }`. So a validity window can only be
added by editing an offer after creating it.

**So the founder is not asking for a new feature.** He is asking for the entry point to a rule
the platform already honours end to end. Worth him knowing: **web does not have this either.**

### 1.4 Per-creator offers are fully modelled and completely unused

`campaign_influencers` already carries, all nullable:

| Column | Meaning |
|---|---|
| `brand_offer_id` | the library offer chosen for this creator |
| `offer_type` + `offer_config_json` | a bespoke offer built for this creator alone |
| `offer_valid_until` | when **this creator's** offer stops discounting |
| `offer_expires_at` | the invitation-acceptance clock — a **different** thing |

The last two look like a duplicate and are not. The database comment settles it:

> *"When this creator's campaign-level OFFER stops discounting. NULL = no deadline. The
> allocation, storefront and commission continue past it — only the discount stops. Distinct
> from `offer_expires_at`, which is the invitation-acceptance clock."*

**Rows using any of it: zero.** Of six `campaign_influencers`, none carries an offer.

`campaign_sets` has **no offer columns at all** — confirmed again. The set-level offer the
wizard used to demand was never stored on the set.

### 1.5 What the phone already has to build with

* `ProductPicker` / `ProductPickerModal` — this would be its **fifth** caller
* `BrandCategoryPickerScreen` — already used by allocation and the request composer
* `DateField` — the pure-JS calendar, already used by Batch A
* `BrandOffersLibraryScreen` — the library list already exists

Nothing here needs a new component from scratch.

---

## 2. What this contract builds

### P1 · Fix the scope defect
`buildDiscount` and `buildVolume` take a scope. Store, a category, or picked products — the
same three the allocation screen already offers, and the same three web writes.

### P2 · The missing type
`free_gift` — buy this, get that. Web has it; the phone does not.

### P3 · Where it redeems
`availing_modes`, the four the web offers, and the warning web shows: a **pay-at-store** bill is
a paper bill and cannot be scoped to a category or to named products.

### P4 · The validity window
Start and end, on the offer. Founder's explicit ask. The columns, the API and the checkout
enforcement all exist — this adds the entry point and closes the `POST` gap in §1.3.

### P5 · The offer moves to the creator
Optional, per creator, opened from her row at step 4. Two routes in, exactly as the founder
described: **pick one from the library**, or **build one for this creator alone**.

---

## 3. The one thing I will not decide alone

A per-creator offer has an **end** (`offer_valid_until`) and **no start column**.

Three options, and this is a commercial choice, not a technical one:

| | |
|---|---|
| **A — start = the set's start** *(recommended)* | No migration. Her offer runs from the day the set does, and stops when you say. Matches how every other date on a set already behaves |
| **B — add a start column** | One nullable column. Only worth it if a brand really needs an offer that begins *after* the set does |
| **C — no per-creator window at all** | Only the library offer carries dates; a creator's offer inherits them |

Recorded rather than guessed. Flagged on the board.

---

## 4. Out of scope, stated

* **Web.** The phone reaching parity with web is the job; changing web is not. Its missing
  validity window is noted in §1.3 as a fact, not a task
* The shopper's side — the follower app already reads `store_ends_at` and already refuses an
  expired offer
* `offer_expires_at`, the invitation clock. A different thing, working, untouched
* Anything about how offers are *published to the store* (`published_to_store`)
* The campaign screen's old six-stage strip — its own stage
