# Rules v1.22 — proposed changes

Everything we decided between 15 and 18 September that the rules doc does not yet say.
Read against **v1.21** (`INFLX_Master_Business_Rules_Phase_1_v1.21_2.docx`, identical to the
15 September copy — I diffed them).

**Seven changes.** Two are new rules you decided. Three write down how something already works
but was never described. Two fill gaps where the doc is silent and the code is not.

Each one gives you the section, why, and text you can paste in.

---

## 1. Hybrid and Pay for Sale — she names where she is posting

**Your decision, 17 September.** This is the one you asked for.

> *"We ask creator to select at least one deliverable for both Pay for Sale and Hybrid in social
> media. He simply upload content and get brand approval. This we don't ask at agreement — only
> as a step to confirm that content is live. We don't demand that particular deliverable, we ask
> him to submit."*

**Why it matters beyond the wording:** today Hybrid's second and third payments **have no way of
being released at all**. The only automatic trigger is confirming a deliverable, and Hybrid has
none — the rules say it needs no content package, and the code agrees. Right now **₹9,375 is
locked in production** across two Hybrid collaborations with no route out but an admin's hand.

This step is what unlocks them.

### §12.1 — Pay for Sale & Hybrid, the shoppable content path

**Add to the flow**, after "Approved → live in Follower App":

> ↓ Creator names at least one social deliverable — which platform and what kind of post she will
> publish ↓ Creator submits the social-media version to the Brand ↓ Brand approves ↓ Creator posts
> ↓ Creator confirms the social post ↓ Brand confirms the social post is live

**Add these sentences underneath:**

> The Creator names at least one social deliverable before posting. The Brand does not specify it
> and cannot demand a particular one — unlike Pay for Content, the content package is not what was
> bought. It is named only so there is something definite for the Brand to confirm as live.
>
> One is the minimum. She may name more.
>
> The Brand confirming that named post is live is the event that moves the payment milestones for
> Hybrid, and the event that completes the collaboration for Pay for Sale.

### §23 — Hybrid Detailed Rules

The line *"No fixed Reel/Post deliverable package is required under Hybrid"* stays true, but it
now needs its companion. **Add immediately after it:**

> Although no package is agreed in advance, the Creator must name at least one social deliverable
> at the posting step (§12.1). The Brand's confirmation that it is live releases the second 25%
> and starts the waiting period for the final 50%. Without a named post there is nothing to
> confirm and the remaining 75% cannot be released.

---

## 2. The final 50% waits 7 days, not "7 or 15"

**Your decision, 17 September:** *"pay for content set it default to 7 days… also let admin decide
if he wants he can set number of days… but make it default 7 days."*

**Already done in the platform.** The live setting is now 7.

### §21 — Payment Models by Aim

**Replace:**
> The final 50% is paid after the Admin-defined waiting period (for example 7 or 15 days).

**With:**
> The final 50% is paid after an Admin-defined waiting period, **seven days by default**, counted
> from the moment the Brand confirms the content is live. Admin may set a different number.

### §25 — Deadlines & Time Rules

**Replace:**
> Admin controls the delay after the second 25% milestone; examples discussed were 7 or 15 days.

**With:**
> Admin controls the delay after the second 25% milestone. **Seven days by default**, counted from
> the Brand's confirmation that the content is live.
>
> This is a different clock from the sales-commission return window below, and the two are set
> separately. One counts from content going live and governs a fixed fee; the other counts from
> each individual sale and governs commission.

**Why spell out the difference:** they were both sitting at 30 days, which made them look like one
thing. They are not.

---

## 3. The campaign fee has two levels

**Your decision, 17 September:** *"default one is 8% we fix… next per brand… if fee calculation
first we check this brand has any separate percentage, next if yes we take 12% calculation, if not
default 8%."*

**Already done.** Before this it did not work — a per-brand percentage was shown to the brand and
then never actually charged.

### §3 — Revenue Model, "Campaign fee for Pay for Content"

**Add to the end of that rule:**

> The percentage has two levels. There is one platform-wide number that applies to every brand,
> and Admin may give an individual brand its own number that overrides it. The brand's own number
> is checked first; the platform-wide one applies when it has none.
>
> Whichever applies is recorded on the Agreement when it is generated, so a later change to either
> number never alters a collaboration already signed.

---

## 4. The platform fee on sales is set per business, not one number

**Your description, 18 September:** *"sale percentage in real time vary per business… for
imitation jewellery it is different, for real gold it is different… so per business percentage is
required… next per business and per brand level."*

**This already exists** — sixteen business types each with their own rates, at
**Admin → Pricing → Categories (L3)**. The rules doc only says "Admin-controlled", which
undersells it and left you thinking fashion was 8% when it is set to 10%.

### §17 — Discount, Commission, Platform Fee & Settlement

**Replace:**
> Platform fee is calculated on the sale amount and the rate is Admin-controlled.

**With:**
> The platform fee is calculated on the sale amount. The rate is set **per business type** — the
> business a store registered under — so one rate applies to everything that store sells, whatever
> the individual product is.
>
> Each business type carries **three rates**, because who brought the sale changes what INFLX
> should take:
>
> | How the sale arrived | Rate |
> |---|---|
> | Straight to the Brand, no Creator involved | the highest |
> | Through a Creator's link, bought there and then | the lowest — she is already earning commission |
> | Through a Creator's link, bought later inside the attribution window | in between |
>
> Admin may also give an individual Brand its own rate, which overrides its business type.
>
> A business type INFLX accepts for registration must have a rate. A business that can register
> but cannot be charged is not a valid state.

---

## 5. TDS and the minimum withdrawal — the doc never mentions them

**Your clarification, 18 September:** *"TDS cut, minimum withdrawal come only during withdrawal
only, not related to any wallet credit (to brand or creator)."*

**The code already agrees** — nothing is deducted when money is credited. But the rules doc does
not mention either, and both are live: 10% TDS, ₹100 minimum.

### New, at the end of §17

> **Withdrawal, and what is taken there**
>
> Nothing is ever deducted when money reaches a wallet. A Creator's milestone payment and her
> confirmed commission both arrive whole.
>
> Two things apply only when money is **withdrawn**, never when it is credited:
>
> - **TDS**, an Admin-set percentage deducted at withdrawal as Indian tax law requires. The
>   correct rate by turnover and threshold is a legal question still to be settled; it is
>   currently 10%.
> - **A minimum withdrawal amount**, Admin-set, applying to both Brands and Creators. It exists
>   only to stop very small requests creating transaction cost, and is not related to any return
>   window or waiting period.

---

## 6. INFLX only accepts fashion businesses

Decided on 2 September and enforced in the platform since, but it appears nowhere in the rules doc
— and it now decides what a store is charged, so it belongs here.

### New, at the end of §2 (Actors, Roles & Identity)

> **Which businesses INFLX accepts**
>
> INFLX is currently a fashion platform. A Brand may register, and may later change its business,
> only to a business type INFLX accepts. Today that is Fashion alone — clothing, footwear,
> jewellery and accessories.
>
> Businesses registered before this rule keep their existing type and are unaffected.
>
> Re-opening a vertical means accepting it for registration **and** giving it a platform-fee rate
> (§17). Neither is complete without the other.

---

## 7. Two small corrections

### §19 — Collaboration Completion Rules, Pay for Content

**Currently:** *"Collaboration completes only after the final 50% payment is released/paid."*
That is right, but it does not say what has to happen first. **Suggested:**

> The collaboration completes after the final 50% is released, which happens once the Brand has
> confirmed the content is live and the waiting period has passed.

### §10 — Funding, Wallet Locking & Shoot Eligibility

Everything in §10 is correct and built, with **one exception worth flagging rather than editing**:

> *"The Brand should therefore be prevented from reaching/using the Shoot step until these
> conditions are satisfied."*

**There is no such check in the platform.** The only gate on the shoot is that both signatures
exist; it never looks at money. It is not currently causing harm — funds lock at the same instant
as the second signature, so a signed collaboration is a funded one — but the rule has no
implementation and **item 10 will build the shoot on top of it.**

No change to the rule. It is correct as written. It needs building, and that is item 10's first job.

---

## What did not change, and why

**The sales-commission return window stays as it is.** The doc says it defaults to 7 days; you have
it set to 30. That is not a contradiction — it is an Admin dial and you set it deliberately. The
doc's "default" is the starting value, not a limit.

**Nothing about item 8** — v1.21 already has the pitch rules and they match what was built.

---

## Is item 9 finished?

**The funding and locking half: yes.** Proved against real money in production, not tests —

- Pay for Sale locks nothing ✓
- Pay for Content locks the fee plus the campaign fee, charged once, to the Brand ✓
- Hybrid locks the fixed fee with **no** campaign fee ✓
- Every split adds back to the whole exactly ✓
- The Creator receives her amount whole, nothing deducted ✓
- The Brand is shown a shortfall before signing and refused again at the server ✓
- The first 25% releases at signature ✓

**The releasing half: not yet, and deliberately so.** Two things remain, and both depend on steps
that do not exist yet:

1. **Hybrid's second and third payments have no trigger** until the step in change 1 is built. It
   begins *"after the shoot she uploads"*, so it cannot be built before the shoot exists.
2. **The shoot funding gate** (change 7) — you deferred it to item 10 yourself.

So item 9's money is done and correct. What is left is not item 9 hesitating — it is two triggers
waiting on item 10.

---

## If you want these applied

Say the word and I will produce **v1.22** as a Word document with these changes made and a version
note at the top, in the same style as the previous versions. I have not edited your document —
this is the proposal for you to read first.
