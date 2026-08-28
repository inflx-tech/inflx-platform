# Before / after

**One optional term on the agreement. No migration, no new machinery.**

---

## What it does

A brand may now state, on **any** aim:

```js
usage: { commercial: true, extra: 8000 }
importance: { usage: 'preference' }
```

She can **counter the price** (`extra: 15000`), **refuse it outright**
(`{ commercial: false }`), or accept. Marked a `requirement` instead, it cannot be countered —
she accepts or declines, which is the honest shape for a brand that genuinely cannot run the
campaign without the rights.

Not raising it leaves the default: **her content stays hers**, and the brand and INFLX may
repost it on their own social accounts with credit.

## Why it needed almost nothing

The optional-term mechanism already existed for `scope` — stated or not, importance marker,
counterable unless it is a requirement, merged by `settle()`.

`usage` joined that list. **One validator, one describer, one line in the loop.**

## No migration

Terms live in `collab_agreements.terms_json`. A new term is a new key. Every existing agreement
stays valid because the term is optional.

---

## One description, four surfaces

`describeUsage()` is a single sentence used by the request, the counter, the agreement summary
and the contract.

Four descriptions of one deal is the fault this codebase has already cleaned up three times — a
duplicated offer vocabulary, a duplicated offer-type normaliser, and a second step model deleted
in Stage 3. One function, so they cannot drift.

---

## ⚠️ My fixture was wrong three times running

Not the model — mine. In order:

1. **Omitted `mode`**, which is required on every collaboration. Six cases failed on
   `terms.mode` and said nothing at all about usage.
2. **Used a posting window** for the paid aims. Refused.
3. **Used `post_by` AND a window.** Also refused: *"a collaboration has one date — the day she
   must have posted by. Use post_by, not a window."*

The posting **window** belongs to the **set**, not the agreement.

Recorded because three wrong fixtures in a row is a signal, not bad luck: I was writing tests
against a model I had not read closely enough, and every failure was the model correcting me.

## And the runner gained `.each`

`test.each` was missing from the no-database runner. **Added to the runner**, not worked around
in the test — a runner that quietly lacks what tests use pushes people towards weaker tests,
which is the slow version of fake green. It is the second matcher added this way today.

---

## Verification

| What | How |
|---|---|
| The term | **20 executing checks** |
| Are they real? | **Mutation-tested. 7 deliberate breakages, 7 caught** — including the term vanishing from the optional list, the validator never being called, and a requirement quietly becoming counterable |
| Regression | stage4-parcel **25/25** · offers-parity **12/12** · coupon **11/11** · mobile **44 suites / 507 tests** |

Certified **no-regression**. **Never claimed green.**

---

## ⚠️ What this does not yet do

**No screen asks for it.** A brand cannot state commercial usage from the app; she cannot see or
counter it.

Deliberate — the model is what four surfaces must agree on, and getting it wrong there means
fixing it four times. But **nothing a user can see has changed yet.** The screens are the next
piece, alongside the contract-at-briefing change.
