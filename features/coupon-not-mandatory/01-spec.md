# A coupon is a label, not the thing that finds the creator

**Founder, 2026-08-28**, blocked publishing Test Campaign 11:

> *"Could not brief Sneha R. — Provide a coupon code for this influencer, or set a coupon prefix
> on the set."*

> *"this should not be mandatory... because whenever he get sale that is trackable which brand,
> which campaign, set, creator, post and product."*

---

## 1 · He is right, and the code said otherwise in a comment

The refusal sat in `campaign.controller.js:1194`, under this:

```js
// Conversion/hybrid sales attribute via coupon — an influencer without any
// code would be untrackable, so reject rather than insert a NULL code.
```

**That comment is false.** Measured against production on 2026-08-28, before changing anything:

| | |
|---|---|
| `campaign_influencers.coupon_code` | **nullable**, unique index (which permits many NULLs) |
| Creators carrying a coupon | **0 of 6** |
| `follower_transactions` attributed to a creator | **16 of 16** |
| …of those, carrying a coupon | **0** |

⚠️ **Sixteen real sales have already been attributed to a creator with no coupon anywhere in
the system.** The rule refused to create something the database holds happily and the money
path already handles.

## 2 · How a sale actually finds her

Every read of the coupon in the money path is the same shape:

```js
const { rows: ciRows } = await db.query(
  `SELECT coupon_code FROM campaign_influencers WHERE id = $1`, [campaignInfluencerId]);
const couponCode = ciRows[0]?.coupon_code || null;
```

**The creator is the input, not the output.** The query is keyed by her id — so the coupon
cannot be what identifies her, and the `|| null` shows every one of those four call sites has
always coped without one.

`follower_transactions` carries `campaign_id`, `set_id`, `offer_id`,
`campaign_influencer_id` and `via_store_influencer_id` — exactly the chain the founder
described. `coupon_code_used` is written **alongside** them, as a label a shop can read off a
bill.

Grepped the whole backend: **the only two queries filtering on `coupon_code` are uniqueness
checks at creation.** Nothing resolves a creator by one.

## 3 · What changed

Two refusals removed:

* **Per creator, at invite** — the one he hit
* **Per set, on an open group** — `coupon_prefix is required for open-group conversion and
  hybrid sets`, resting on the identical false premise

⚠️ The second was **not** in what he reported. It is removed anyway, because leaving one of two
identical rules is how the app comes to contradict itself on the next screen along — which is
precisely the fault he found on the Review screen the day before.

## 4 · What deliberately stays

* **A coupon passed for a creator is still used**, and still checked for uniqueness
* **A prefix on the set still generates one per creator**, `PREFIX_FIRSTNAME`
* **A content set is still refused a prefix** — nothing is being sold, so there is nothing to
  discount

This is not the removal of a feature. A brand who wants codes on their bills still gets them.
**The change is that not wanting them is now allowed.**

## 5 · What the phone does, and does not, need

The founder: *"in web we have but in mobile new version dont have field of coupon code... you
can add while building offer... but it should not be a mandatory."*

**So no phone change is needed.** The phone never sent a coupon and now no longer has to. Web
keeps its field. A brand who wants per-creator codes sets a prefix on the set, which the phone
already supports and which generates them automatically.

## 6 · Out of scope

* Adding a coupon field to the phone — he explicitly did not ask for one
* Web
* Anything about how a coupon is redeemed at a shop counter
