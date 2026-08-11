# Collaboration Restructure — Implementation Plan

Status: **PLAN ONLY — nothing locked, nothing built.**
Drafted 2026-08-11 from the founder's campaign-creation discussion.
Method: complete plan first → discuss each part in flow → lock each part → then implement.

---

## The shape we're building toward

The brand's journey after login, as the founder defines it:

**List products → publish (push to store) → apply offers on published products →
find creators and agree terms (pre-campaign) → create the detailed campaign →
everything else for every actor flows from the campaign.**

Two structural truths hold this together:

1. **The campaign is the spine.** All collaborations, product allocation, money and
   analytics source from it. Nothing downstream exists without it.
2. **Agreement comes before the campaign.** A cheap handshake settles interest and the
   main terms. Only then does the brand invest effort in building the detailed campaign.

Today the platform has the spine but only half the handshake, and where the handshake
exists it bypasses the spine by fabricating a stub campaign.

---

## Part 1 — Corrections (no decisions needed)

Five things are simply wrong today. None depend on any design choice, so they can be
locked and shipped without waiting for the rest of the plan.

**1.1 — Offers ignore whether a product is published.**
Founder's call: publish means push-to-store, and that's correct as-is — but an offer
must not be able to sit on an unpublished product. Today nothing checks. An offer built
over unpublished products silently covers items no customer can see.
*Change:* offer creation and editing only accept published products; if a product is
later unpublished, the brand is told which offers it affects.

**1.2 — Commission is displayed to customers as a discount.**
A creator's storefront falls back to the commission percentage when it can't find a real
discount value. A 10% commission surfaces as "10% off" — a discount that won't be applied
at checkout. This misfires only on the sales aim, because that's the only aim where
commission exists without a discount.
*Change:* remove the fallback. No discount means no discount is shown.

**1.3 — Campaign basics shows a fake wallet requirement.**
Every brand, including commission-only ones, sees a hardcoded ₹2,50,000 "covers this
campaign", an escrow-lock warning, and a pre-ticked "Wallet topped up" that reflects
nothing.
*Change:* show the real balance, tick only what's actually true, and hide the card
entirely when no money is involved.

**1.4 — The two apps write different offer vocabularies into one column.**
The per-creator offer type is unconstrained text. Web writes `Discount`, `Volume
discount`, `Free gift`; mobile writes `flat`, `percentage`, `prebook`. Collaborations
created on the two apps are not comparable data.
*Change:* one vocabulary, enforced, with existing rows migrated.

**1.5 — Campaign start is forced 7 days out by a frontend-only rule.**
No backend counterpart. It blocks a brand from launching now.
*Change:* remove it.

**To decide before locking Part 1:** whether unpublishing a product should block, warn,
or silently drop it from live offers.

---

## Part 2 — The pre-campaign handshake

The headline new capability. Today creators can pitch brands; brands cannot pitch
creators at all.

### 2.1 — Brand-initiated requests

**What exists:** nothing. The brand can search creators and view profiles, but its only
outreach either requires a campaign to already exist, or targets unclaimed scraped
creators to get them onto the platform.

**What we build:** the brand can send a collaboration request to a creator before any
campaign exists, and both sides can accept, reject or negotiate it.

### 2.2 — The terms model (founder's design)

Not every term matters equally, and the model should say so.

**Money and time are the two primary terms.** Always stated, always negotiable.
- *Money* — commission % for sales, fee for engagement, both for hybrid.
- *Time* — when content is expected to go up. Not campaign duration: for a sales
  collaboration there is no duration, so time means the posting expectation.

**Everything else is optional.** Including deliverables — the brand often doesn't know
which channels a creator has, so it shouldn't be forced to guess.

**Anything stated carries an importance marker.** When either side fills an optional
term, they mark it as either a **requirement** or a **preference**. A requirement must be
settled before agreement. A preference is explicitly put to the other party as a
question — "we'd like this, what works for you?" — rather than presented as fixed.

This is what keeps the handshake cheap: two things must be agreed, everything else is a
conversation.

**What the request carries:** aim · money · time · what's being promoted (whole store,
a category, or specific products) · collaboration mode (store visit / product shipment /
remote) · deliverables (optional) · a message.

**What it must not carry:** coupon codes, product allocation, offer configuration, the
brief, or reference assets. None can be correct before the campaign exists, and including
them is exactly why the current acceptance path fabricates a stub campaign.

### 2.3 — Three ways to reach creators

All three mechanisms already exist in the codebase; they're wired to campaign publish
instead of to a pre-campaign stage. We reuse them:

- **Specific** — browse the Influencers tab, pick one, send.
- **Group** — send to a saved creator group. Groups are already server-persisted with
  members.
- **Filter-matched** — broadcast to everyone matching tier, niche (primary or secondary),
  city, minimum engagement rate and gender. The matcher already works.

The difference from today: this runs **before** the brand commits to building anything,
and for open sales arrangements it should keep running rather than firing once.

### 2.4 — Where it lives

**In the Influencers tab**, because that's where the brand already starts — searching for
creators. The handshake is a natural extension of that surface, not a separate area.

**On web and mobile both.** Detailed campaign creation stays web-only by design. The
pre-campaign handshake does not: a brand needs to answer a creator, negotiate money and
timing, and agree terms from their phone.

### 2.5 — Brand-side abuse controls

The creator side already has opt-in, an eligibility bar, a cooldown after rejection, and
a five-active cap. The brand side has none, because brand outreach never existed. A
filter-matched broadcast could reach hundreds of creators, so it needs an equivalent:
volume limits, a cooldown after a creator declines, and creator-side control over what
they receive.

**To decide before locking Part 2:** what the brand's volume limits are; whether a
creator can opt out of brand outreach entirely; and whether a filter-matched request is a
single broadcast or a standing recruitment that keeps matching.

---

## Part 3 — Handshake to campaign

### 3.1 — Agreement stops producing a campaign

Today accepting a pitch immediately manufactures a campaign, a set, an assignment **and**
a contract draft — a one-person stub with none of the real campaign's offer, coupon
prefix, products or brief. This is the single worst break in the current flow.

**What we build:** agreement produces an **agreement record only**. The creator lands in
a *ready to brief* list on the brand's side. No campaign, no set, no contract.

### 3.2 — Campaign creation starts from agreed creators

Campaign creation opens knowing how many creators have agreed and are waiting. The brand
picks some or all, and they land in a set with their agreed terms pre-filled and still
editable.

**Many agreements become one campaign**, distributed across sets — not one campaign per
agreement. That's what the existing structure supports: a campaign holds several sets, a
set holds many creators.

### 3.3 — Contract creation moves

The contract should be created once the creator is really in a set with real terms — not
at the moment of agreement. Today it fires at acceptance, describing a campaign that
isn't real. This is a reordering of an existing step, not new machinery.

### 3.4 — Agreed terms are locked at campaign stage

If a creator can renegotiate commission after agreeing to it, the handshake bought
nothing. Settled terms display as settled and closed. Negotiation stays open for the new
specifics the campaign introduces.

### 3.5 — Existing stub campaigns

Production already contains campaigns created by the old acceptance path. They need a
decision: leave them alone, or fold them into real campaigns.

**To decide before locking Part 3:** whether an agreement goes stale (an accepted
handshake sitting unbriefed for months probably shouldn't stay actionable), and what
happens to the existing stubs.

---

## Part 4 — Offers and allocation

The founder's model is already correctly built on the paths that matter: offers are
created either on the dedicated offers page or inside campaign creation, and allocated to
creators only through a campaign. The problems are elsewhere.

### 4.1 — Retire the dead set-level offer path

A set-level offer table exists that is neither of the two creation levels — it attaches to
a set, not a creator. **Nothing in either app writes it.** Yet the read layer joins it,
**prefers its discount value over the per-creator offer's**, uses it as the source of the
product list for allocation, and accepts its existence as proof a coupon is shoppable.

A dead write path the read path still trusts. This single fact explains most of the
confusion in the offer layer.

*Change:* the per-creator offer becomes the only truth; the library offer is what it
snapshots from; the set-level table leaves the read path.

### 4.2 — Allocation becomes a record

Today there is no "assign these products to this creator" action. Allocation is
recomputed live from the offer's scope every time it's needed. Consequences: nothing
records what a creator was actually given, editing an offer silently rewrites the past,
and `store` scope quietly means "the entire catalogue, including everything added later."

*Change:* allocation becomes a stored act — which products, to which creator, under which
offer, from when. This is the one genuinely new structure in the whole plan, and the
thing that makes tracking fully clear.

### 4.3 — Selling without a discount

A creator's storefront requires an offer to exist before it shows anything, coupon
resolution refuses a code with no offer, and allocation with no offer computes to empty.
**Three independent blocks** on a creator simply promoting normal-priced products for
commission — a case the sales aim needs.

Once allocation is its own record rather than a by-product of the offer, all three
dissolve.

### 4.4 — Offer expiry

No offer in the campaign path can carry an expiry. The set-level table has no date
columns, the per-creator config carries none, and the field that looks like it would work
is the invitation-acceptance clock — reusing it would silently expire invitations. Saved
library offers do have validity dates, but the coupon path ignores them.

*Change:* the offer gets a real expiry, and it becomes the only thing that stops selling.
No offer means no date anywhere.

**To decide before locking Part 4:** whether `store` scope stays "everything, always" or
freezes to the products live at allocation time.

---

## Part 5 — Separating the sales aim

**Good news first: the money layer is already separated correctly.** Wallet lock is
fee-driven, not aim-driven — the code's own comment says conversion-only contracts skip
it. Escrow tranches follow the same fee. Campaign publish only checks the wallet when a
set is engagement or hybrid. A commission-only collaboration already touches no wallet,
locks no escrow, and creates no tranche.

What's wrongly shared is the **interface and the dates**, not the money.

### 5.1 — Budget leaves campaign basics

Asked of every brand today, before the aim is even known. The wizard already computes the
total of set allocations, and the publish check compares against exactly that.
*Change:* the campaign total becomes the sum of what's allocated in sets. No structural
change to the wizard — the field simply goes.

### 5.2 — Sales collaborations run open-ended

End date is required at creation today. Everything downstream already treats a blank end
date as "never expires" — every discovery query and the coupon check are written that
way, and campaigns with no dates already exist in production via the old acceptance path.
*Change:* end date becomes optional; the aim-aware rule moves from creation to publish,
where the aim is actually known.

### 5.3 — An explicit end

Once collaborations are open-ended, nothing can close them: the auto-complete job keys
off an end date, and nothing decrements stock on an order, so "runs till stock sells"
cannot self-finish. *Change:* the brand gets an explicit End, on web and mobile.

### 5.4 — Sales-appropriate presentation

No budget, no wallet, no escrow language anywhere in a commission-only campaign.

**To decide before locking Part 5:** whether the campaign keeps an optional budget
**ceiling** (blank = no cap) or drops the concept entirely; and whether hybrid defaults
to open-ended or to its posting window.

---

## Part 6 — The creator side

### 6.1 — Two-level acceptance

Agreement at the handshake, then a lighter confirmation at the campaign — confirming only
what the campaign newly supplies: the coupon code, the allocated products, the exact
posting date, the brief, the offer. Settled terms show as settled.

### 6.2 — Industry filter on brand browse

The creator browses brands accepting proposals today, but the only filter is a
business-name search. The brand's category is already returned — it just isn't
filterable. Small change, directly requested.

### 6.3 — Open campaign discovery

Whether a creator can see open sales campaigns and ask to join one. Distinct from the
handshake: the handshake is "we agreed, nothing built yet"; this is "your campaign is live
and I want in."

**To decide before locking Part 6:** whether 6.3 is in scope at all, and if so whether a
creator's request targets a specific campaign or stays brand-level.

---

## Part 7 — Content tracks (deferred)

Content currently splits into two disconnected systems: campaign deliverables, which the
**brand** approves, and platform posts, which an **admin** approves with no link back to
any deliverable or collaboration. A creator can have a brand-approved deliverable and no
platform post, or a platform post the brand never saw.

For the sales aim — where the platform post is what actually sells — that's backwards.
One submission should satisfy both.

This is the deepest change in the plan and gets its own contract, last.

**To decide:** whether admin still reviews content the brand has already approved.

---

## Sequence

Dependencies, not preference:

| Order | Part | Why here |
|---|---|---|
| 1 | Part 1 — Corrections | Independent. No decisions. Ships alone. |
| 2 | Part 4 — Offers & allocation | Foundation. Unblocks no-discount selling, which Part 5 needs. |
| 3 | Part 5 — Sales separation | Small once allocation no longer depends on offers. |
| 4 | Part 2 — Handshake | The big new build. Depends on nothing above. |
| 5 | Part 3 — Handoff | Needs Part 2 to exist. |
| 6 | Part 6 — Creator side | Needs the two-level acceptance from Parts 2–3. |
| 7 | Part 7 — Content tracks | Deepest. Own contract. |

Parts 2–3 could run before 4–5 if the handshake is the priority — they don't depend on
each other. Part 1 should go first either way.

## Delivery notes

- Detailed campaign creation stays **web-only**. The pre-campaign handshake and the End
  action are **web + mobile**, which means Maestro verification and an OTA release, not
  just a web deploy.
- Part 4's allocation record and Part 2's agreement record are the only genuinely new
  structures. Everything else reuses what exists.
- Each part becomes its own contract under `features/`, discussed and locked before any
  code.
