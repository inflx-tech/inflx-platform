# Phase 1 — what actually changed

Written after building, in plain language. This phase turned out smaller and stranger than
the contract predicted, and this records the difference rather than tidying it away.

---

## The three screens that changed

### 1 · Her earnings — two words and one sentence

**Before.** The headline read "AVAILABLE TO WITHDRAW". Beneath it, a figure labelled
"PENDING", with no explanation.

**After.** The headline reads **"YOURS TO KEEP"**. The second figure reads **"IN RETURN
WINDOW"**, and one line sits under the card: *"Commission becomes yours 30 days after each
sale, once it can no longer be returned."*

**Why.** "Pending" reads as *arriving next week*. When it does not arrive, the creator stops
believing the number. Naming the reason costs one line and prevents that.

**Untouched:** the amount, the Withdraw button, the collaboration list, everything else.

### 2 · Inside a collaboration — two new sections

**Before.** A tranche timeline and a list of individual commission payments. Nothing said
which product sold, and nothing said which post sold it.

**After.** Two sections below the existing ones:

- **What sold** — every product she is allowed to sell, with how many went and what she
  earned. **A product that sold nothing appears too, reading "NONE SOLD YET".** That is the
  point of the section: it tells her which product is not working. A list built only from
  sales could never show it.
- **Which post sold them** — each of her posts with the orders and commission it drove.

Each section only appears when there is something to show, so nothing renders as an empty
box.

### 3 · What she can sell in a campaign — grouped

**Before.** One flat list, newest first. The only label anywhere on the screen was the
shop's trade.

**After.** Grouped by the product's own kind, with a chip per kind and a count. Anything not
yet labelled goes to **"Other"**, always last — it stays sellable, and it makes the labelling
gap visible instead of hiding stock.

**Untouched:** the per-product note, the create-post button, the offer banner, what she is
allowed to sell.

---

## The bug we did not know about

Two earnings screens were **already failing** — the server was asking the database for a
date field that does not exist on that table. Any creator with a campaign opening her
earnings would have hit it.

It survived because the code returns early when a creator has no campaigns, and until
recently that was nearly everyone. **Empty data does not just delay value; it hides faults.**

Fixed. The earnings section now returns three campaigns where it previously errored.

---

## How the contract differed from reality

| The contract said | What was true |
|---|---|
| Three items, including brand pitch controls | Those controls were **already built**, on the phone and the desk |
| Her earnings split by collaboration was missing | **Already built**, already on screen. I built a duplicate and removed it. |
| Products grouped in three places | **One** of those screens exists. The other two are server capability nobody calls. |
| Six sales to verify against | Six sales exist; **none is attributed to a creator**, so the money screens show zero |
| No bugs mentioned | **One live bug found and fixed** |

Four wrong claims, all from the same habit: searching for a name I expected, checking one
side and assuming the other, and trusting my own earlier note as evidence. Recorded as a
standing rule — survey before spec, and nothing may be called missing unless it was checked
from both ends.

---

## How it was proved

- Both earnings screens return data against the live system where one previously errored.
- The new product breakdown returns **all eight** of a real collaboration's allowed
  products, every one reading zero — precisely the ones a sales-only list would hide.
- Asking for a collaboration that is not hers returns nothing.
- Her shelf comes back carrying the product kind; **all 92 products** in the system have one.
- Every style name and imported symbol on the changed screens was checked to exist. Eight
  were missing and were added — the screens parsed and built fine without them, and would
  have rendered unstyled with no error at all.
- App tests: **143 passing**. Backend tests: **319 passing**. A full production build of the
  app succeeds.

**Not proved, and stated plainly:** none of the money figures has been seen with real money
in it, because no creator has earned anything yet. The breakdowns are correct in shape and
correctly return zero; they have never been watched working on a live sale.
