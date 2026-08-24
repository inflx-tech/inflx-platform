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
