# Phase 1 — the order of work

Four slices. The two halves are independent, so the money work and the product work can run
side by side.

---

## Before any screen is written — the re-check

Your rule, added on 15 August: **before the first screen of a phase is built, we go back to
its mockup and say plainly what we are actually about to build.**

For this phase that means three screens, restated against the drawings we already agreed:

1. **Her earnings** — the lifetime figure stays where it is; a split by collaboration appears
   beneath it.
2. **Inside one collaboration** — what it paid, which products sold, which posts sold them.
3. **A list of products** — grouped by kind, in the three places she meets one.

Not a redesign. A read-back, so we catch "that isn't quite what I meant" while changing it is
still free.

---

## Slice 1 · Add up what a collaboration paid

Every sale already knows which campaign, creator, offer and product it belongs to. This groups
what is already there.

Three groupings, all from the same records:
- per collaboration
- per product, inside a collaboration
- per post, inside a collaboration

**The rule that must not slip:** money she can count on and money still in the return window
stay two separate figures, everywhere they appear. Never one blended number.

---

## Slice 2 · Send the product's kind

Three places serve products and none of them sends the kind. Each sends the *shop's trade*
instead, which is why everything reads as one flat list.

The fix is the same in all three: include the label the product already carries.

**Checked at the screen, not at the database.** A label that exists in storage and never
reaches the app is a label that does not exist — and that exact failure has happened here
before.

---

## Slice 3 · The screens

Her earnings gains the split. The collaboration screen gains what-it-paid, which-products,
which-posts. The three product lists group by kind, with anything unlabelled in "Other".

The brand gets the same sales cut by creator, product and post — inside their own campaign
only, and nothing beyond it.

---

## Slice 4 · The boundary, tested

The line about what a brand may see is easy to write and easy to breach by accident. It gets
its own checks: her earnings from other brands, her other collaborations and her total income
must be **unreachable**, not merely off-screen.

---

## How we verify

Everything in `03-expected-outputs.md`. Three that matter most:

- **P1** — the parts add up to the whole. If the per-collaboration amounts don't sum to her
  lifetime figure, we have double-counted or lost a sale, and that is worse than showing
  nothing.
- **P15** — the product's kind actually arrives at the screen, not just exists in storage.
- **P9** — a brand cannot reach anything beyond their own campaign.

The sales already in the system are the test data. They are real and correctly stamped, so
the totals have a right answer we can check against rather than a made-up one.

---

## Deploy

Server first, then both phone apps.

**No database change.** Nothing to run beforehand, nothing that can go wrong with data —
worth saying because every other phase in this programme has one.

An old phone that hasn't updated keeps working exactly as it does today: the server sends
more than before and takes nothing away.

---

## What would make me stop and come back to you

- **If the parts don't add up to the whole.** That would mean sales are being attributed in a
  way I have misunderstood, and I would rather ask than pick an interpretation and present a
  number to a creator that is wrong.
- **If a lot of products turn out to be unlabelled.** A handful in "Other" is fine. If it is
  most of them, grouping is not the fix and we should talk about labelling first.
