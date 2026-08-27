# Batch B — before / after

**A live bug fixed, four gaps closed, a rule that already existed given a way in, and the offer
moved to where the database always kept it.**

---

## 1. Board by board

### ③ What the offer applies to — the live bug

| | |
|---|---|
| **Promised** | Whole store, a category, or chosen products |
| **Built** | All three, on discount and volume |
| **Diverged** | Nothing |

`buildDiscount` and `buildVolume` both hardcoded `scope: 'store'`. **Two places, not one.** Every
discount and every volume offer built on a phone covered the whole store whatever the brand
chose. Both offers in production are whole-store, and nobody can now say whether that was
intended.

A half-finished scope is **refused, in words** — "Pick the category this offer covers" — rather
than quietly falling back to the whole store, which is how the bug hid in the first place.

Categories reuse `BrandCategoryPickerScreen`'s flattened tree; products reuse `ProductPicker`,
its **fifth** caller, exactly as ledger #86 predicted.

### ③ The fifth type

`free_gift` — buy this, get that. On web, absent on the phone, so a brand who wanted to give
something away had to open a laptop. **More than one pairing** is allowed, because web allows
it: "buy a saree, get a bindi set" and "buy a lehenga, get a clutch" are one offer with two
pairings, not two offers competing for one basket.

### ④ Where it redeems, and the warning

`availing_modes` is now **sent explicitly, always**.

⚠️ It never was before. `createOffer` deliberately omits the column when it is not supplied so
the `NOT NULL DEFAULT '{pay_at_store,online_order}'` applies — so every phone-built offer
silently became redeemable **both** ways. Both production offers show exactly that, and nobody
chose it.

The warning web shows now shows here too: a pay-at-store bill is a **paper** bill, it has no
basket, so it cannot be scoped to a category or to named products. Saying so before the offer
is saved beats a brand wondering for a month why it never applies in the shop.

### ④ The validity window

| | |
|---|---|
| **Promised** | A start and an end |
| **Built** | Both, on the library offer and on each creator's own |
| **Diverged** | It needed a **server change** the survey had not predicted |

`POST /brands/me/offers` did not accept the dates at all — only `PATCH` did. So a brand could
only give an offer a window by saving it and then editing it. The POST now takes both, and
refuses an end before the start in words.

Everything below that already existed: the columns, and the refusal at checkout, **both ends**,
in `transaction.controller.js`. The shopper app already showed the end date. This gave a live
rule its first way in.

### ① ② The offer moves to the creator

| | |
|---|---|
| **Promised** | Optional, per creator, from the library or built for her alone |
| **Built** | Both routes, plus her own dates |
| **Diverged** | See §3 — the bespoke route does **not** create a library row |

---

## 2. Migration 162 — and why I was wrong to recommend deriving it

I recommended deriving a creator's offer start from the set's, to avoid a migration.

**The founder overruled it, correctly:** *"set date is for all creators… say one individual
creator may be work from different time. offer start and end per creator is necessary."*

A set has one start date for everybody. Creators do not all begin on it — one signs late, one
is travelling, one is asked to hold until a launch. Deriving her offer's start from the set's
would have meant a creator who starts three weeks late carries an offer that has been
discounting to nobody for three weeks, **with no way to say so.**

One nullable column, no default, no backfill. Applied to production: 6 rows before, 6 after,
nothing touched, 0 carrying a start.

---

## 3. A bespoke offer does not join the library

The founder: *"create one at that moment **dedicatedly for that campaign, set, influencer**."*

The first cut reused the builder as-is, which POSTs to `/brands/me/offers` — so a "bespoke"
offer landed in the library anyway, and the sheet's own hint said it did not. **A lie on a
screen**, caught by reading back what I had written.

The builder gained an `inline` mode: it runs every check, produces the same config, and hands
it back instead of saving a row. The offer is stored on her `campaign_influencer` as
`offer_type` + `offer_config_json`, which the server validates through the **same**
`validateOfferConfig` a library offer goes through — nothing is skipped except the library row.

A check asserts the inline branch sits **after** validation, so it can never become a way round
it.

---

## 4. Two shapes, never both

A library pick writes `brand_offer_id`. A bespoke build writes `offer_type` +
`offer_config_json`. **Never both** — with both present nobody could say which one a shopper
actually got, and the server snapshots a library offer's config at attach time precisely so a
later edit to the library cannot silently change a deal already struck.

A mutation that writes both is caught.

---

## 5. The round-trip defect nobody had reported

Web writes products as `{ id, name, price }`. The phone wrote `{ id }`.

The server only needs the id, so this looked harmless. It is not: **web's editor rehydrates its
product pickers straight out of the stored config** (`d.bnd_prods = c.products`). A bundle or
BOGO built on a phone and opened on web showed products with **no name and no price**.

Found by reading web's `draftFromOffer` rather than by assuming the server's needs were the only
needs. The phone now writes the full shape.

---

## 6. A test that encoded the bug

`offerBuilders.test.js` opened with:

```js
expect(buildDiscount({ subType: 'pct', value: '20' }))
  .toEqual({ ok: true, config: { sub_type: 'pct', value: 20, scope: 'store' } });
```

That is the defect, pinned in place by a check. **A test that encodes a bug is worse than no
test**, because it makes fixing the bug look like a regression.

**Rewritten to the new intent, not deleted and not loosened.** It now asserts the full shape and
that scope is `store` only when nothing else was asked for.

---

## 7. How the two builders are stopped from drifting again

`offerParity.test.js` does not compare two lists that agree today. It **lifts web's
`buildOfferConfig` out of its source and runs it**, on the same input, and compares the objects.

All five types, all three scopes. If web's builder is renamed or restructured, the extraction
**throws** rather than passing quietly.

The reason is written at the top of `campaignChannels.js`: *"already had to clean up two
duplicated vocabularies (offer types written differently by web and mobile, and a duplicated
offer-type normaliser). A third is not worth it."*

---

## 8. How this was verified

| What | How |
|---|---|
| The builders | **23 checks**, running web's own builder against the phone's |
| The backend | **12 executing checks** via `scripts/run-test-file.js` |
| Per creator | **21 checks** over the payload and the wiring |
| Are they real? | **Mutation-tested. 16 deliberate breakages, 16 caught** |
| The migration | Applied to production with a before/after guard: 6 rows in, 6 out, nothing moved |
| Regression | Full mobile suite: **42 suites, 450 tests** |

Two of my own checks were wrong first time — one used a constant name that does not exist
(`TYPES` for `OFFER_TYPES`), one a handler name that does not exist (`inviteInfluencer` for
`invite`). **Both failed loudly** rather than passing on an empty slice, because after Batch A
every extraction now asserts it found something before asserting anything about it.

**Certified no-regression. Never claimed green** — the backend suite still cannot run.

---

## 9. What to check on the handset

⚠️ **W4 is the one that matters.** Give a creator an offer that ended yesterday, then try to use
it as a shopper. It must be refused. The rule is old and enforced; what is new is the date
reaching it, across four hops — screen, API, column, checkout. **A date that saves but never
arrives would look exactly like it worked.**

Then W2: build a **category-scoped** offer. Nothing has ever written a non-store scope from a
phone, so that path from this client to the server's validator has never once been driven.
