# Part 6 — The creator side

**Program:** `Docs/COLLAB_RESTRUCTURE_PLAN.md`, part 6 of 7. Parts 1, 4, 2 (which absorbed
3) and 5 have shipped. This part is about what the *creator* sees and can do, now that the
brand side has been rebuilt around them.

---

## 0. What the audit found (verified 2026-08-12, prod + code)

Three things, and the third changes the shape of this part.

### 0.1 The creator is never told which terms were already agreed

Part 2 made acceptance one click for an agreement-backed collaboration — the server 403s
any attempt to renegotiate what was already settled. But **`campaign_influencers.agreement_id`
is never returned to the creator on any endpoint.** Verified: zero references in
`influencer.controller.js`.

So Asha, who spent three days agreeing 15% and a 15 September post-by date, opens the
campaign invite and sees… a fresh invite. Nothing says *"you already agreed this."* The
one-click promise is honoured by the API and invisible in the product.

### 0.2 Brand browse filters on name only

`discoverEligibleBrands` selects `b.category` **and** `u.city AS brand_city`, and filters on
`b.business_name ILIKE` alone (`proposal.service.js:217-234`). Both useful filters are
already in the payload and simply unreachable. Exactly as the plan described.

### 0.3 The open-campaign application flow is **half-built and unreachable**

This is the significant find, and it is the same failure shape as the dead offer join.

**What exists (brand side):**
- `POST` approve and reject handlers for applications, gated on `ci.status = 'applied'`
  (`campaign.controller.js:1952-2130`), including cap-filling logic that expires remaining
  applicants when a set reaches `max_cap`.
- A brand-inbox counter: `pending_applications` where `ci.status = 'applied'`
  (`brandInbox.controller.js:175, 217`).

**What does not exist:** **anything that writes `status = 'applied'`.** Every INSERT into
`campaign_influencers` in the entire backend writes `'invited'` (three sites, all verified).
There is no creator-facing route to browse open campaigns and no route to apply to one.

**Production confirms it has never run:**

| | |
|---|---|
| `campaign_influencers` by status | contracted 18 · active 1 · **applied 0** |
| `campaign_sets` by mode | **handpick 7 · open_group 0** |

So the brand's application inbox can only ever show zero, and open groups — the mode the
whole application flow serves — have never been used once.

**And it would not work even if built.** Part 4 recorded a leftover: an open-group joiner
carries **no allocation** and **no `commission_pct`**. Since Part 4, having something to
sell *is* the gate for appearing in the follower app. So a creator who joined an open
conversion set would be contracted, visible in the brand's roster, and **unable to sell
anything**. Building the apply route without fixing that ships a dead end.

---

## 1. Scope decision — 6.3 is DEFERRED, and this is why

The plan asked: *"whether 6.3 is in scope at all, and if so whether a creator's request
targets a specific campaign or stays brand-level."*

**Recommendation: defer it, as its own contract, and do not start it here.**

1. **Creators already have two ways to reach brands, both shipped days ago and neither
   verified on a real device.** Pitches (creator → brand) and now requests (brand → creator)
   both produce agreements. Open-campaign apply would be a *third* channel into the same
   place, built before the first two have been used once.
2. **It serves a mode with zero production usage.** Not one open-group set exists. Building
   the creator half of a feature whose brand half has never been exercised is speculation,
   not sequencing.
3. **It is not the flow the founder described.** The founder's model is *agree first, then
   the brand builds the campaign*. Open-campaign apply is the reverse — the campaign exists
   and the creator asks in. That is a real feature, but it is a new idea rather than a
   completion of this program.
4. **It cannot be done honestly in one step.** It needs the Part 4 open-group leftover
   fixed first (allocation + commission for joiners), or the creator joins and cannot sell.

**What Part 6 does about it instead:** nothing silent. The dead brand-side machinery is
**recorded, not deleted and not quietly left to look functional** — see §4.

## 2. §6.1 — The creator sees what is settled and what is new

**Today.** An agreement-backed invite is indistinguishable from a cold one. The creator
re-reads terms they already negotiated, with no signal that the money and timing are closed.

**Change.** The creator's collaboration detail returns the agreement's provenance, and the
screen splits the terms in two:

- **Already agreed with you** — the money and time settled at the handshake, shown as
  settled, with the date they were agreed. Not presented as something to decide again.
- **New in this campaign** — what the campaign actually adds: the coupon code, the exact
  posting date, what they can sell, the brief, and any offer.

Accept stays one tap; this makes the screen say what the API already enforces.

**Also delivered here:** the collaboration detail gains an **allocation summary** — *"You
can sell: their whole store"* / *"Ethnic Wear"* / *"12 products"*. The allocated products
are already reachable (`GET /influencers/me/campaigns/:id/products`, shown on
`CampaignProductsScreen`), but the detail never says *what the scope is* — so a creator
allocated the whole store cannot tell that new arrivals will join automatically.

**Cold invites are unchanged.** A creator invited without a prior agreement sees exactly
what they see today, including the full negotiate flow.

## 3. §6.2 — Filter brands by industry and city

**Today.** Search by business name only.

**Change.** Category and city become filters on the same endpoint, both already present in
the payload. Values come from the brands actually listed, so no empty filter is ever
offered.

**Mobile only — corrected before lock.** The first draft of this spec said "web and
mobile". There is no creator-facing web surface at all: `brand-web` is the brand and admin
dashboard, and nothing in it references brand discovery. Creators are a mobile-only
audience, so the web assertion (P1) was removed rather than left to fail or, worse, be
satisfied by building a page nobody asked for.

## 4. What this contract records rather than builds

Two findings that must not be re-derived, and must not be mistaken for working features:

1. **The application flow is unreachable.** Brand-side approve/reject and the
   `pending_applications` counter exist; nothing can create an application. The counter is
   therefore permanently zero. This contract does **not** delete the machinery (it is the
   correct receiving half of a real future feature) but records it plainly, and adds a test
   pinning that no creator-facing apply route exists — so a future half-build is a
   deliberate decision rather than an accident.
2. **Open-group joiners cannot sell** (Part 4 leftover, unchanged). Whoever picks up 6.3
   must fix that first.

## 5. Scope boundary

**In:** §6.1 (settled-vs-new + allocation summary) and §6.2 (category/city filters).
Backend + mobile + web. **No migration** — `agreement_id` and the `alloc_*` columns already
exist from Parts 2 and 4.

**Out, explicitly:** §6.3 open-campaign discovery and application (deferred with reasons
above) · the Part 4 open-group allocation/commission leftover (belongs with 6.3) ·
`resolveBusinessStore` offer fields · deleting the transitional allocation fallback · the
web group/broadcast composer entry points (Part 2 leftover) · Part 7 · the cancel/escrow
refund defect (filed separately, own contract, money path).

## 6. Founder decision requested at lock

**Is §6.3 deferred, as recommended?** If instead it should be built now, it needs its own
contract and must include the Part 4 open-group fix, or creators will join campaigns they
cannot sell from.
