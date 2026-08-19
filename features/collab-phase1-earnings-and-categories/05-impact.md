# Phase 1 — impact

**In one line:** the lowest-risk phase in the programme. No database change, no money moves,
and everything shown already exists — it is being grouped and sent, not calculated anew.

---

## Where the risk actually sits

### 1 · Showing a creator a number about her own pay

This is the real exposure, and it is about trust rather than breakage.

If the per-collaboration figures do not add up to the lifetime figure she already knows, she
will believe one of them is wrong — and she will be right. Worse, if we blend money she can
count on with money still in the return window, she sees a number, expects it, and receives
less. That is the fastest way to lose a creator's confidence in the app.

Hence two of the checks exist purely for this: the parts must sum to the whole, and the two
kinds of money are never shown as one.

### 2 · A brand seeing something that isn't theirs

Cutting sales by creator means writing queries that walk from a campaign to a creator. Written
carelessly, one of those could reach her work for someone else.

The line is not new — it already holds elsewhere in the product — but this phase writes fresh
queries across it, so it gets its own checks rather than being assumed.

### 3 · The label that exists but never arrives

The product's kind is already stored. The only way this phase fails quietly is if the label is
read from storage, computed, and then dropped before it reaches the screen — leaving a flat
list that looks exactly like today's.

That precise failure has happened in this system before, which is why the check is written
against what the screen receives, not against what the database holds.

---

## What is untouched

No commission rate, no return window, no payout timing, no wallet, no escrow. No campaign, no
contract, no shoot, no post, no offer. The follower app.

**No database change at all** — no new tables, no new columns, nothing to run beforehand. That
makes this the only phase so far with no data risk whatsoever.

---

## Safe for phones that have not updated

Yes, and simply: the server sends more than it did and removes nothing. An old app ignores
what it does not recognise and behaves exactly as it does today.

---

## Deploy class

Server plus both phone apps. No database work. Explicit go still required before it goes out,
because the server release is what makes it live.

---

## Where it could still go wrong

- **A sale attributed in a way I have misread.** If the parts don't sum to the whole, the
  cause is that I have misunderstood how a sale is stamped — not an arithmetic slip. I would
  come back rather than pick an interpretation and put a wrong number in front of a creator.
- **Most products turning out to be unlabelled.** If "Other" swallows the majority, grouping
  is cosmetic and the real fix is labelling, which is a different conversation.
- **This phase makes something visible that was previously invisible.** If the attribution
  itself has ever been wrong, this is the phase where a creator finds out. That is the right
  outcome and worth being ready for, rather than surprised by.
