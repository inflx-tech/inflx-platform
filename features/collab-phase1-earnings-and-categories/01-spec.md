# Phase 1 — what a collaboration paid, and products you can actually browse

**Programme:** `features/collab-programme/00-phase-plan.md`, phase 1 of 8.
**Mockups:** already drawn — the earnings screens in `step-detail-tracking-and-catalogue`
panels ② and ⑨, and the grouped catalogue in panels ④ and ⑤.

Two small things people will notice the day they land. Neither needs anything from Phase 0,
and neither needs a decision from you.

---

## A correction before the scope

I told you Phase 1 had three items. The third — *"a brand can set who may pitch them"* — is
**already built**. A brand can turn pitches on and off and set all five filters, on both the
phone and the desk, and it shipped under its own contract some time ago.

I had it recorded as missing in four separate places. Every one of those came from checking
the back end and the web dashboard folder, and never once opening the brand's phone app. That
is the repo's own "check it twice" rule, and I did not follow it.

Corrected everywhere. **Phase 1 is two items.**

---

## 1 · What each collaboration actually paid her

### What is wrong today

Asha works with Kanchi Silks at 18% and Label Fern at 22%. She has earned **₹14,000**.

The app shows her ₹14,000. It cannot show her that **₹9,000 came from Kanchi Silks and
₹5,000 from Label Fern** — or which saree sold, or which of her posts sold it.

Kanchi Silks, meanwhile, **can already see** what their campaign brought in.

> The brand knows what a collaboration earned. The creator does not — in a product where
> commission is her entire pay.

### Why this is the cheapest thing on the whole list

Nothing needs recording that isn't already recorded. Every sale is *built* to carry which
campaign, which creator, which offer and which product it came from. Nobody ever wrote the
line that adds them up per collaboration. That is the whole job.

### But it will show zero on day one, and you should know that before we build it

**Checked 2026-08-15, and it corrects something I told you.** I said there were "six real,
correctly stamped sales" to test against. There are six real sales — and **not one of them
is attributed to a creator.** No creator has earned anything, ever. Every wallet is empty.

I briefly thought that was a fault in the tracking. It is not. I misread a label: those six
sales are marked "influencer" only because no *brand* store offer was applied to them — it
is the fallback wording, not a sign that a creator sent the shopper. They are ordinary direct
purchases with no creator involved. **Nothing is broken.**

So the honest position: nineteen collaborations have reached contracted or active, but no
sale has yet come through a creator's shop or post.

**My recommendation is still to build it now**, for one reason: the alternative is that the
first creator sale happens and she cannot see it. Building it afterwards means someone earns
money the app cannot show her. Built now, it is simply empty until the first sale lands, and
correct from the moment it does.

**What that costs us in confidence:** the check "the parts add up to the whole" cannot be
proven against real money today — nought equals nought proves nothing. So it will be proven
against a sale we construct on purpose and then remove, exactly as the negotiation history
was proven in the last phase. That is a real check, but it is not the same as watching it
work on a live sale, and I will not describe it as if it were.

### What she gets

- Her lifetime total, split by collaboration
- Inside one collaboration: what it paid, which of that brand's products sold, and which of
  her posts sold them
- **Confirmed money and money still in the return window, always shown apart.** Commission
  only clears thirty days after a sale, once it can no longer be returned. A creator who
  sees one number and receives a smaller one stops trusting the app.

### What the brand gets in this phase — nothing new

I drafted this with the brand getting the same figures cut their way, and then checked it
against the plan you approved. **The brand's cuts are Phase 8**, and pulling them forward
here would have widened the phase without asking.

They stay in Phase 8. The groundwork this phase lays — grouping sales that are already
stamped — is the same groundwork those cuts will use, so Phase 8 gets cheaper. But it does
not get done here.

A brand's per-campaign total already works today and is untouched.

---

## 2 · Products you can browse instead of scroll

### What is wrong today

Asha wants to look through Kanchi Silks' 39 sarees the sensible way: silk, cotton, party,
bridal.

**The products are already labelled.** Every product in the system carries a kind, and most
also sit in a proper tree of categories. The sorting work is done.

But every screen that shows her products sends her **the shop's trade** — "fashion",
"restaurant" — and never the product's own kind. She gets a flat list, newest first, with a
search box.

> It is a shop that knows exactly which shelf every item came from, and prints a receipt
> saying only "clothing shop". She cannot sort by a label she was never handed.

### The same omission, three times

1. **Browsing a brand** while deciding whether to pitch them
2. **Seeing what she is allowed to sell** in a campaign
3. **Her own shelf**, across every brand she works with

Fixing what gets sent fixes all three at once.

### What changes

Products arrive with their kind attached, and the three screens group by it. Anything not yet
labelled goes into an "Other" group rather than disappearing — hiding unlabelled stock would
hide real stock, and it makes the gap visible so it gets tidied.

---

## What we are deliberately not doing

- **Any change to how money is calculated.** This shows money that already exists, grouped a
  new way. No rate, no rule, no payout timing moves.
- **The brand's pitch controls** — already built, see the correction above.
- **How a post performed** — views, taps, saves. Nothing measures those yet, and that stays
  deferred until both ends of it exist.
- **Any navigation change.** Nothing moves tab or screen. That is Phase 2.

---

## The final output

Afterwards:

- Asha can open one collaboration and see what it paid her, which products sold, and which of
  her posts sold them — with the money she can count on shown apart from the money still
  settling.
- Anyone looking at a list of products sees them grouped by kind, in all three places she
  looks.
- Kanchi Silks sees nothing new in this phase — their per-campaign total already works and
  is untouched. Their cuts by creator, product and post are Phase 8.

**And on day one all of the money figures read zero**, because no creator has yet been paid
anything. That is correct, not broken — see the section above.

---

## What moves

| | |
|---|---|
| **The database** | Nothing. No new tables, no new columns, no migration. |
| **The server** | Adds up existing sales per collaboration; starts sending the product's kind. |
| **The creator's app** | Earnings screen gains the split; three product lists get grouped. |
| **The brand's app** | Nothing. Their cuts are Phase 8. |
| **The desk** | Nothing. |

---

## Deploy

The server changes and both apps change, so this goes out as a server release plus an update
to the two phone apps.

**No database change at all**, which is unusual for this programme and worth saying plainly:
there is nothing to run beforehand and nothing that could go wrong with data.

**Safe for phones that have not updated.** The server sends more information than before and
removes nothing, so an old app simply ignores the new fields and behaves exactly as it does
today.
