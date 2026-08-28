# Commercial usage — a negotiable term on the agreement

**Founder, 2026-08-28:**

> *"usage rights means two things — usage for commercial, and just publishing content in social
> media accounts (in brand, in inflx social media accounts)... if brand want to use commercially
> then we keep it in agreed terms only — ask brand to tell 'I will use commercial purpose', for
> that if agree I will give some extra... this thing should settle even before detailed campaign
> creation (in agreement itself)."*
>
> *"for commercial rights in all types (commission, pay for content, pay for both) should be
> settled before detailed campaign... very simple... **dont make it complex.**"*

---

## 1 · Two rights, two places — this is the whole design

| | Where it is settled | Negotiated | Paid |
|---|---|---|---|
| **Showing her content** on the brand's and INFLX's own social accounts | The **contract**, by default | No | No |
| **Commercial use** — paid ads, print, packaging | The **agreement**, before any campaign | **Yes** | **Yes** |

⚠️ **The placement is the point.** A brand who wants commercial rights has to ask **before the
campaign is built**, while she can still say no, or say yes for a price.

Putting it in the contract would mean asking her at the moment she is trying to start work —
the worst possible time to raise a price, and she would feel it.

## 2 · Kept as simple as he asked

One flag and one number:

```js
usage: { commercial: true, extra: 8000 }   // the brand asks, and offers ₹8,000 for it
usage: { commercial: false }               // explicitly no — how she refuses in a counter
// absent                                  // nobody raised it; social-only usage applies
```

Nothing else. No duration field, no channel list, no rights matrix. If that turns out to be too
little, it is one key away — but building it larger first would have been exactly what he told
me not to do.

## 3 · Why it slots in without new machinery

The agreement already has an **optional term** mechanism:

* Stated or not — optional means optional
* Anything stated carries an **importance marker**: `requirement` or `preference`
* A `preference` is **counterable**; a `requirement` is not — *"accept it or decline"*
* `settle()` merges an accepted counter into the agreement

`usage` joins `scope` on that list. It needed a validator and a describer, and **nothing else**.

## 4 · All three aims, unlike deliverables

Deliverables are only negotiable where a fee exists — a commission buys nothing in advance.

**Usage is different.** A commission-only creator's content is exactly as reusable as a paid
creator's, and the founder said so directly: *"in all types."*

## 5 · One description, four surfaces

`describeUsage()` returns one sentence, used by the request, the counter, the agreement summary
and the contract.

Four places describing the same deal in four ways is the fault this codebase has already had to
clean up three times — a duplicated offer vocabulary, a duplicated offer-type normaliser, and a
second step model deleted in Stage 3. One function, so they cannot drift.

## 6 · What is deliberately NOT built here

⚠️ **No screen asks for it yet.** A brand cannot state commercial usage from the app, and she
cannot see or counter it.

That is on purpose. The model is the piece four surfaces must agree on; getting it wrong there
means fixing it four times. But it also means **this changes nothing a user can see until the
screens land.**

## 7 · Out of scope

* The screens — request, counter, agreement summary, contract
* The contract-at-briefing change, which is the next piece
* Policing commercial use after the fact. The agreement records what was permitted; enforcing
  it is a human matter, and the platform should not pretend otherwise
* Any duration on the permission. The founder's answer was that usage survives the
  collaboration ending; no expiry was asked for
