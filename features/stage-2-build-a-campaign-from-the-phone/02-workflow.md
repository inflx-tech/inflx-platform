# Stage 2 — workflow

The flow this stage must execute end to end. Success is **this walk completing on a
handset**, not "it compiled".

---

## W0 · Starting state

A brand with:
* at least 3 agreements in `collab_agreements` with `status='ready'` — at least one
  `terms_json.aim='conversion'` and one `'engagement'`
* a published product catalogue (`brand_products`, `is_active=true`)
* a wallet balance that is **short** of the content set's fee total at first

---

## W1 · Land on Campaigns

Brand opens the Campaigns tab.

**Expected:** the list, and one **+ New** control in the header. Each row carries aim, sets,
creators, the date line (*started* for sales, *ends* for content), and money (*sold* for
sales, *committed* for content). Ended campaigns stay, greyed. The ready-to-brief nudge sits
at the **bottom**, not the top.

**Must not:** show the *"Create new campaign on web"* link. It is replaced, not accompanied.

---

## W2 · The shell — two fields

Tap **+ New**.

**Expected:** a name field and a start date. A lock note stating no end date and no budget
live here, because both belong to a set and both depend on the aim.

`POST /campaigns` with `{name, start_date}`.

**Expected end state:** a `campaigns` row, `status='draft'`, `total_budget` NULL,
`end_date` NULL.

---

## W3 · Set 1 — the sales set

### W3.1 Pick the aim
Three cards, each stating its commercial consequence. Pick **Sales**.

**Expected:** a note that the aim cannot change once creators are added.

### W3.2 Basics
**Expected on a sales set:**
* Set name and Starts — asked
* **Ends** — rendered, disabled, explained: *"No end date on a sales set."*
* **Budget** — rendered, disabled, explained: *"Commission is paid out of a sale that
  already happened."*
* **Channels** — multi-select (Instagram · YouTube · WhatsApp · their INFLX shop) and a
  minimum count, framed as guidance
* **No "who posts?" step anywhere**

`POST /campaigns/:id/sets` with `{name, goal:'conversion', window_start, channels_json}`
and **no** `set_budget`.

**Expected end state:** a `campaign_sets` row, `goal='conversion'`, `set_budget` NULL,
`channels_json` populated. `campaigns.end_date` recomputed to NULL, `total_budget` NULL.

### W3.3 Pick the agreed creators
**Expected:** a pick-list of unbriefed agreements, **filtered to this set's aim**, with a
count of how many were hidden as the wrong aim. Each row: photo, agreed terms in one line,
date agreed, **days left** — red under 14. A lock note: *"You can't add someone who hasn't
agreed"*, with a link out to the Creators tab.

Tapping a row opens the agreement and its diary. Tick two.

**Must not:** write anything to the server. Ticking is local state until publish (spec §5.1).

### W3.4 Terms — section ① settled
**Expected:** each ticked creator read back — commission, post-by, where she shoots — with
**one** control: *what she can sell*. A creator whose agreement carried a scope shows it
pre-filled; one that did not reads **"Not set yet"**.

Set Meera's scope to a **category**. Set Asha's to **specific products** via the picker.

**Expected of the picker:** grouped by category, images, price, search, select-all per
group, a running count and total value, and an **Other · uncategorised** group that stays
visible with a nudge to tag them.

**Expected of the scope screen:** each of the three options states auto-join behaviour
before it is chosen — store and category absorb new stock, a hand-picked list does not.

### W3.5 Terms — section ② the offer
**Expected:** *"Use a saved offer"* / *"Make a new one"*. The library first, expired offers
shown **greyed, not hidden**. A note that only one offer applies per basket, best for the
shopper, creator's own wins a tie.

Build a new 10%-off-₹5,000+ discount. Scope it with the **same picker** as W3.4.

**Expected:** the basket preview — a sample basket, every candidate offer scored, the
winner marked, what the shopper pays, and **what the creator earns at her commission**.

Save the set.

---

## W4 · Set 2 — the content set

Add a second set. Pick **Content**.

**Expected on the content branch:**
* Posting window **From / To** — asked
* **Set ends** — calculated from the window, not typed
* **What you're buying** — deliverable counters (reel / story / post / YouTube)
* **Budget** — calculated, stated as *"Adds up from what you agreed with each creator"*
* **Section ② closed** with a reason: nothing is being sold, so there is no basket
* **Payment stages** shown instead — 25 / 25 / 50

Pick the one engagement agreement.

**Expected end state:** `campaign_sets` row `goal='engagement'`, `set_budget` **derived**
from the sum of that set's agreed fees (spec §5.2). `campaigns.total_budget` = that sum.
`campaigns.end_date` stays **NULL**, because set 1 is `conversion`.

---

## W5 · Review, and every blocker in turn

Open Review.

**Expected:** starts, sets, creators, wallet needed, and a **drift panel** naming any term
that moved from what was agreed — by creator and by field — with a route back to fix it.
Then *what happens next*: invites go out, they accept in one tap, agreements are consumed,
shoot plans are created on signing.

Now prove each blocker fires. Publish must be **refused, by name**, for:

| # | Set up | Expected refusal |
|---|---|---|
| W5-a | A creator on the sales set with scope cleared | names her — she would be contracted and unable to sell |
| W5-b | The sales set's offer removed | names the set — nothing gives a shopper a reason |
| W5-c | Wallet short of the content total | `WALLET_INSUFFICIENT`, naming required vs available |
| W5-d | An agreement expired mid-wizard (age it in the database) | names her, and sends her back to Talking |
| W5-e | An offer scoped to an unlisted product | names the product |

**Must not:** any of these silently succeed. **Must not:** a warning about drift block —
drift is warned, never blocked.

---

## W6 · Publish

Fix everything, top up the wallet, publish.

**Expected end state, asserted in the database — not in the response body:**

1. `campaigns.status='active'`, `published_at` set
2. `campaigns.total_budget` = the content set's derived total; `end_date` **NULL**
3. Three `campaign_influencers` rows, each with `agreement_id` set, `alloc_scope`
   non-NULL, and the sales rows carrying `commission_pct` — not a fee
4. All three `collab_agreements` now `status='consumed'`, with `consumed_campaign_id` and
   `consumed_ci_id` filled
5. `GET /brands/me/agreements` no longer returns any of them
6. Each creator has a notification whose deep link resolves to a registered route

---

## W7 · Abandon — the negative case

Start a second campaign, tick two agreements, kill the app.

**Expected:** both agreements still `status='ready'` and still in **Ready to brief**. No
`campaign_influencers` row was written. The draft campaign may exist and is harmless.

---

## W8 · The creator's side, unchanged

The creator opens her invitation.

**Expected:** one **Accept**, no Negotiate — because `agreement_id` is present. The terms
she sees are the ones she agreed, and any that moved are named. This is Part 6 behaviour and
this stage must not disturb it.

---

## W9 · Regression boundary

* Brand web can still build and publish a campaign the old way, including a typed
  `set_budget` — which is now overwritten by the identical derived value (spec §5.2)
* `pnpm qa` certified **no-regression against the 93-failure baseline**, never claimed green
* Mobile suite green
* Duplicate-route check clean across all stacks — the Stage 1 fault that crashes handsets
  while passing every bundle check
* **The founder walks W1–W8 on a handset before any deploy go is requested**
