# Stage 2 — A brand builds a campaign from the phone

**Contract:** `features/stage-2-build-a-campaign-from-the-phone/`
**Plan:** `Docs/THE_PLAN.md`, Stage 2 of 11. Stages 0 and 1 shipped.
**Drawn from:** `features/brand-mobile-spine/04-preview/mockups/final-2-campaign.html` (FINAL 2)
and `features/collab-navigation-spine/03-action-ledger.html` actions **59–98**.
**Written:** 2026-08-25, before any code.

---

## 1. What a brand will be able to do afterwards

Take creators they have already shaken hands with, and turn those handshakes into a live
campaign **without opening a laptop**.

Today the brand app's Campaigns tab ends in a link that says *"Create new campaign on web"*.
After this stage it holds a four-step wizard: pick the aim, fill the basics, tick the
agreements you already hold, and set the one thing that is still genuinely open — what the
shopper gets.

After this, **one job is left on the desk: adding and pricing products.**

---

## 2. Reality check — every item, does it exist, and where I looked

Verdicts are from reading the files named, not from memory. Three verdict words:
**EXISTS** (works today, on some surface) · **PART** (half of it exists) · **MISSING**.

### 2.1 Backend and database

| # | Ledger item | Verdict | Evidence |
|---|---|---|---|
| 60 | Create a campaign — name + start only | **EXISTS** | `campaign.controller.js:333` `create` — takes `name`, `start_date`; **ignores** any `total_budget`/`end_date` sent and writes NULL for both |
| 67–68 | End date and budget derived, never typed | **EXISTS** | `services/campaignRollup.service.js` — `derive()`: total = sum of paid `set_budget`; end_date NULL if **any** set is `conversion` |
| 61–62 | Add / edit / delete a set | **EXISTS** | `campaign.routes.js` — `POST/PATCH/DELETE /campaigns/:id/sets[/:sid]` |
| 64 | The three aims | **EXISTS** | `campaign_sets.goal` enum `engagement \| conversion \| hybrid` (migration 001). Friendly labels only in UI — `collabTerms.model.js` deliberately reuses this enum rather than inventing `sales/content/both` |
| 65–66, 70 | Set name, start, posting window | **EXISTS** | `createSet` — `name`, `window_start`, `window_end` |
| 69 | **Channels a creator may use + a minimum** | **MISSING** | Grepped `channel` across `backend/src/` and all 156 migrations. The only hit is a **comment** in `collabTerms.model.js:18`. No column, no field, no validation, nowhere |
| 71 | "Who posts?" removed | **EXISTS (as a default)** | `campaign_sets.influencer_mode` defaults `'handpick'`. Nothing needs removing server-side — the phone simply never asks |
| 72 | See your unbriefed agreements | **EXISTS** | `GET /brands/me/agreements` → `handshake.service.listReadyToBrief:434`. Returns `a.*` (so `terms_json`, `expires_at`, `created_at`) plus `profile_image_url`, `instagram_handle`, `followers_count`, `influencer_name`. Filtered to `status='ready' AND expires_at > now()` |
| 74 | Filter the pick-list by aim | **EXISTS (as data)** | `terms_json.aim` is on every row. No server filter param, but none is needed — the list is small and already delivered |
| 76 | Blocked from adding a stranger | **PART** | Nothing forbids a cold invite server-side (correct — cold invites stay a separate flow). The block is a screen rule |
| 77 | Consume the agreement **on publish** | **DIVERGES** | `campaign.controller.js:1182` consumes it inside **invite**, not publish. Guarded UPDATE (`WHERE status='ready'`) so it cannot double-brief. See §5.1 |
| 78–79 | Read back settled terms; warn on drift | **EXISTS** | `invite` validates the agreement is this brand's, this creator's, `status='ready'`, and **aim-matched** (`:1020`), then returns `agreement_warnings[]` naming each moved term (`:1198–1211`) |
| 80, 83–85, 88 | Allocation: store / category / products, auto-join | **EXISTS** | Migration 148 — `alloc_scope`, `alloc_category_node_id`, `alloc_category`, `alloc_product_ids`. Resolved **live**, so store and category scopes auto-join new products by construction |
| 86–87 | Product picker, grouped, searchable, with images | **EXISTS (data)** | `GET /brands/me/products` returns `image_url` (resolved via `resolveProductImage`), `price`, `section`, `category_key`. `GET /brands/me/listing-tree` gives the tree |
| 89 | Use a saved offer | **EXISTS** | `GET /brands/me/offers`; attached per creator by `resolveOfferAttachment:831` |
| 90–95, 97–98 | Offer builder — five types, value, min, scope, redemption, expiry, save | **EXISTS** | `POST /brands/me/offers`; `offerConfig.validator.js`; `campaign_influencers.offer_valid_until` (migration 148) |
| 96 | **Basket preview — which offer wins** | **PART** | The resolver exists — `offerResolution.service.resolveBestOffer:138`, best single offer, never stacked. The only HTTP door to it is `POST /transactions/cart/price`, which is **follower-authenticated**. A brand cannot call it |
| 63 | Review and publish | **PART** | `POST /campaigns/:id/publish` exists and enforces **one** of the five blockers — the wallet. See §2.2 |

### 2.2 The publish blockers — read line by line

I read `campaign.controller.js:1400–1583` end to end. What is enforced:

| Blocker from the board | Enforced today? |
|---|---|
| Wallet doesn't cover a content budget | **YES** — `:1483` `WALLET_INSUFFICIENT` |
| Campaign has at least one set | **YES** — `:1414` |
| A creator on a sales set has no allocation | **NO** |
| A sales or both set has no shopper offer | **NO** |
| A chosen agreement expired mid-wizard | **NO** |
| An offer covers products not in the store | **NO** (checked at offer *write* time, not at publish) |

Four of the five named blockers do not exist. This is the largest single backend gap in the
stage, and it is the one that matters commercially: a creator can currently be published
into a sales set **with nothing to sell**, which makes her contracted and invisible.

### 2.3 The brand phone

| Item | Verdict | Evidence |
|---|---|---|
| Campaign wizard on the phone | **MISSING** | `BrandNavigator.js` registers `CampaignList`, `CampaignDetail`, `BrandCampaignSetsList`, `BrandCampaignInfluencersList`, `BrandCampaignReviewQueue`. **No create route of any kind** |
| The current way in | **A web link** | `BrandCampaignListScreen.js:336` — `openWebDashboard('/dashboard/campaigns')`, labelled *"Create new campaign on web"* |
| `createCampaign` / `createSet` in the app's API layer | **MISSING** | `Packages/Mobile/src/services/api.js` — `brandApi` has `getCampaigns`, `publishCampaign`, `endCampaign`, `inviteInfluencer`, `getCampaignSets`. **No create/update/delete for campaigns or sets** |
| Agreements list on the phone | **EXISTS** | `brandApi.listAgreements()` → `/brands/me/agreements`, already used by the Creators tab |
| Product picker | **EXISTS ×2 — and that is the problem** | `screens/brand/BrandProductPickerScreen.js` (186 lines, a screen, for the request composer) **and** `components/brand/ProductPickerSheet.js` (95 lines, a modal, for the offer builders) |
| Category picker | **EXISTS** | `screens/brand/BrandCategoryPickerScreen.js` — flat list with a readable path, backed by `getListingTree` |
| Offer builder | **EXISTS** | `BrandOffersLibraryScreen.js` + `utils/offerBuilders.js` (`buildDiscount/Volume/Bogo/Bundle`). Discount creation on the phone; the other four types are manageable but not creatable there |
| Sets list | **EXISTS (read-only)** | `BrandCampaignSetsListScreen.js` — displays goal badges, funnel, mini-roster. No create or edit |

### 2.4 The two-things-doing-one-job check

The Stage 1 handover names this as the recurring fault: *four* of its twenty-one bugs were
two implementations of one job, only one getting the change. So I looked for it first.

**Found: two product pickers already.** `BrandProductPickerScreen` and `ProductPickerSheet`
both answer "choose products from this brand's catalogue", with different data handling and
different shapes. Ledger #86 says the picker has **four callers** — allocation, offer scope,
the parcel builder, and the creator tagging products in a post. Building a third would make
it certain that they drift.

**Decision:** this stage does **not** add a picker. It merges the two into one component and
re-points both existing callers at it. That is the first slice, before any wizard code.

### 2.5 Brand web, for honesty

The web wizard is `Packages/brand-web/app/dashboard/campaigns/new/page.js`, 2,759 lines:
three top steps (Campaign · Build sets · Review) with five sub-steps
(`goal | basics | fork | pick | terms`).

It pre-fills from **one** agreement at a time, arriving as `?agreement=<id>` (`:715–755`).
The multi-select pick-list the board draws — every unbriefed agreement, filtered by aim,
with a days-left countdown — **has never existed on any surface**. Same story as Stage 1's
bulk-ask: the engine was finished and the screen was never drawn.

---

## 3. What changes

Written as things a person can do afterwards that they cannot now.

1. **Start a campaign from the phone.** Name it, give it a start date, and nothing else —
   because nothing else belongs at campaign level any more.
2. **Add a set and pick its aim**, with each option stating its commercial consequence, not
   just its name.
3. **See end date and budget as derived, greyed and explained** rather than absent — so a
   brand who used the old wizard learns the rule instead of thinking the screen is broken.
4. **Say what reach a sales creator brings** — which channels, and a minimum count — instead
   of dictating post counts to someone who only earns if she sells.
5. **Tick the agreements you already hold**, filtered to this set's aim, each row carrying
   the agreed terms, the date agreed, and how many days are left before it lapses.
6. **Read back what each creator gets**, and set the one gap — what she may sell — from a
   product picker that groups by category, shows images, searches, and states plainly
   whether new stock will auto-join.
7. **Choose or build the shopper offer**, and **see a sample basket resolve** before
   publishing — which offer wins, by how much, and what the creator earns.
8. **Be stopped from publishing something broken** — a creator with nothing to sell, a sales
   set with no reason for a shopper to use it, or an agreement that lapsed mid-wizard.

---

## 4. What we are NOT doing

| Not this | Why |
|---|---|
| Adding or pricing products on the phone | Bulk work against a catalogue. The founder's own boundary, and the only desk job left after this stage |
| A third product picker | §2.4. Two already exist; this stage merges them |
| Open-group / broadcast sets on the phone | Ledger #71 removes "who posts?" entirely. Every phone-built set is `handpick` from agreements. Open groups stay a web concern, and `D-3`/`D-4` in `Docs/TEST_PLAN_PARTS_1_TO_6.md` say that path is still defective |
| Cold invites — inviting a creator with no agreement | Deliberate. Everything downstream assumes terms are settled. Cold invites stay their own flow with full accept/decline/negotiate |
| Rewriting the web wizard | It works. This stage changes web only where the shared rules move (§5.1, §5.2), and says so |
| Volume / BOGO / bundle / free-gift **creation** on the phone | The library manages all five; the phone creates discounts. Extending creation is its own piece of work and the board does not require it for a campaign to be built |
| The needs-you roll-up and the drill-down | That is **Stage 3**. This stage builds the campaign; Stage 3 watches it |

---

## 5. Decisions this stage has to make, and my answer

### 5.1 When is an agreement consumed?

**The board says publish (#77). The code says invite (`:1182`).**

They disagree, and the board is right about the intent: *"abandoning the wizard must not burn
the agreement."* But the code is not wrong today, because on **web** the invite happens at
the same moment as everything else — there is no long-lived draft holding ticked agreements.
On the phone there will be.

**My answer: leave the consumption where it is, and never invite until publish.** The phone
wizard holds ticked agreements in local state and calls `invite` only inside the publish
step. Abandoning the wizard writes no `campaign_influencers` row at all, so nothing is
consumed. This gets the board's behaviour with **no change to a guarded transaction that
already works**, and no second consumption path to drift.

The cost is one real risk, and it must be handled rather than hidden: an agreement can lapse
between ticking and publishing. That is exactly the fourth publish blocker in §2.2, and it is
why it is in scope.

### 5.2 Where does a content set's budget come from?

**The board says calculated from the agreed fees. The code says typed** — `createSet` throws
`'set_budget is required for engagement and hybrid goals'` (`:646`).

Deriving `set_budget` from `SUM(campaign_influencers.agreed_fee)` is the consistent move: it
is the same shape as `campaignRollup`, and a value defined as a function of its parts cannot
disagree with them. But it changes a validation the **web** wizard depends on, and web is out
of scope by the founder's own phones-first instruction.

**My answer: make it derived, and make the server the one that derives it.** Concretely —
`set_budget` becomes optional on write for paid sets, and is recomputed from the sum of that
set's agreed fees on every invite and every set write, exactly as `campaignRollup` recomputes
the campaign total. Web keeps sending a typed value; it is simply overwritten by the same
number it would have computed, so nothing there breaks. **This is the one change in the stage
that touches a rule brand-web relies on, and it is flagged in `05-impact.md`.**

### 5.3 Channels — a new column, or terms?

Ledger #69 asks a sales set which channels its creators may use and a minimum count. Nothing
like it exists (§2.1). The agreement's `terms_json` carries `deliverables` per creator, but
channels here are a property of the **set** — guidance for who fits — not of one creator.

**My answer: a new nullable JSONB column on `campaign_sets`.** Additive, no backfill, no
constraint that could reject historical rows. It is guidance and blocks nobody, so it needs
no enforcement anywhere else.

---

## 6. Open question for the founder

**One, and it is small.** Ledger #94 lets an offer be redeemed *in store*, *online*, or
*both*. Stage 6 in `Docs/THE_PLAN.md` flags that Pay-at-store is currently **on for all
brands** and nothing has ever asked a brand whether they have a counter.

If a brand builds an in-store-redeemable offer here, the phone will offer a redemption mode
that may be untrue for them. The board's screen offers both toggles.

**My recommendation: build both toggles as drawn, and leave the Pay-at-store question to
Stage 6 where it belongs.** An offer's redemption mode is not the same switch, and holding
this stage for a Stage 6 decision helps nobody. Flagging it so it is not a surprise later.

Everything else in this stage follows from boards already agreed, or from a verdict recorded
above.
