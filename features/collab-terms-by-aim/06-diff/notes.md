# Before / after

# Item 1 — the ₹0

## What was wrong

Every money line on the creator's campaign screen read:

```
agreed_fee || influencer_budget || 0
```

A sales collaboration has no fee — she earns a percentage of what she sells. So all four
places rendered **₹0** and told her the work was unpaid.

**The commission was in the payload the whole time.** `cs.goal` and `ci.commission_pct`
are both selected by the endpoint. The screen never asked for them.

Confirmed in production before touching anything:

| Campaign goal | Rows | With a commission | With a fee |
|---|---|---|---|
| conversion | 4 | **4** | 0 |
| engagement | 2 | 0 | 2 |

**Four live campaigns** — 18%, 15%, 20%, 22% — every one showing ₹0 to the creator.

## What changed

All four sites now read one description of the deal: the headline, the terms row, the
accept prompt, and the decline wording.

* **18%**, with **"of everything you sell"** beneath it. The note is not decoration — a
  bare percentage does not say *of what*.
* Labelled **Commission**, not Fee.
* Passing offers **"Commission too low"**. The *stored* reason stays `fee_too_low`, because
  every report and brand-side screen already reads that value; only her words change.
* Nothing agreed yet reads **"Not set yet"**, never ₹0.

## Extracted rather than left in the screen

The logic lives in `utils/collabPay`, with **14 tests**. It is money: a figure that decides
whether someone accepts work should be checkable without a handset, and the whole fault was
that nobody could see what the screen would render until it rendered.

## One judgement worth recording

**The money present decides; the campaign goal only breaks the tie.** A row can disagree
with its set's stated aim — a conversion set carrying a real fee, or an older row with no
goal at all. Reading `goal` alone would reproduce the same ₹0 in a different costume, so
the shape of the money is authoritative. Two tests pin exactly that.

## Evidence

Mobile suite **173/173** (was 159 — the 14 new money checks). Android bundle builds.
No backend change, no migration.

---

## Item 1, second pass — I fixed the wrong screen

The founder, with a screenshot of the **Collabs list** still reading **FEE ₹0**:
*"i did nt understood what you did on first fix, still have same zero."*

He was right. The first pass changed `CollabDetailScreen` — the page you reach by tapping a
row. The **list you look at first** is a different file with its own row component and its
own normalisers, and it was never touched. Reporting item 1 as done after fixing one of
them was wrong.

## Where the ₹0 actually lived

Four separate places, not one:

| Place | Fault |
|---|---|
| `CollabDetailScreen` | fixed in the first pass |
| `CollabRow` | hard-coded label **"Fee"**, value `fmtRupees(collab.fee)` |
| `normalizeRequest` | `fee: settled?.money?.fee \|\| 0` — a sales request carries a percentage and **no fee** |
| `normalizeProposal` | `fee: p.proposed_fee \|\| 0` — same |
| `getMyCampaigns` (backend) | **never sent `commission_pct` at all** — the list had no way to show anything else |

The screenshot's two rows are **collab requests**, not campaigns — Invitations is fed by
`normalizeRequest`. So even a perfect row component would still have rendered ₹0.

## What changed

* Backend: the campaigns list now sends `commission_pct` and `influencer_budget`.
* Both conversation normalisers carry `goal`, `commission_pct` and `agreed_fee`, so a row
  can **describe** the deal instead of assuming a fee.
* `CollabRow` uses the same `describePay` as the detail screen, so **the list and the page
  it opens cannot disagree about what someone earns**.
* A counter supersedes what was first proposed.

## Why this happened, recorded plainly

I searched for the money field in one screen, fixed what I found, and shipped. The lesson
is the one this codebase keeps teaching: **the same fact rendered in more than one place
will be fixed in one of them.** The answer was to give both surfaces a single shared
description — which is now what they use, pinned by tests that construct a list row and
assert what it will show.

## Evidence

Mobile **178/178** (was 173 — five new list-level checks). Bundle builds. The shipped list
query run against production: four sales campaigns now carry 18 / 15 / 20 / 22, two content
campaigns carry ₹30,000 and ₹25,000.
