# Before / after

**Reported:** *"when i click on it it is opening blank page."*

## The blank page

`heroFor` and `sectionsFor` matched the stage names used **before Stage 1 renamed them**. The old
list and the real list overlapped in exactly **one** value. Every other stage fell through to a
default that said *"This collab is closed"* with no buttons — on a live invitation, and on a
shoot with a parcel on the way.

Its own test file passed, because every case fed it the old names. The file's closing comment
already described this exact fault, about a neighbouring function deleted in Stage 3 for it, and
nobody had read it.

Fixed earlier this session. A guard now walks every stage `deriveStage` can return through both
functions, so the two lists cannot drift again.

## The sign screen

**Before** — campaign, brand, fee, deliverables, production, payment schedule, signatures.

**After** — the same, plus:

- **What You Can Sell** — *"Only Sarees counts towards your commission. Sales of anything else do
  not."* On a pay-for-content collab the card does not appear at all.
- **Shopper offer / Offer runs** — the offer by name, and both ends of its window. Open-ended
  reads *"no end date"* rather than a blank.
- **Your Content** — the usage sentence, from the same function the agreement uses.
- **"I can't do this collaboration"** — beneath Sign.

Set name is absent, per the founder.

## The route

**Before:** brief -> Invitations -> blank page -> accept -> contract drafted -> To sign -> sign.

**After:** brief -> To sign -> sign. Or decline, with her own words.

## Screenshots

Not captured. The device walk is the founder's, and this needs a live brief on a clean agreement
from his own phone — the exact walk that reported it. `04-preview/` holds the mockup the sign
screen was built against.

---

# The blank page, part two — 2026-08-28, after the deploy

**Reported:** *"it is landed correctly into sign tab, but when i am trying click review, again a
blank screen."*

The routing worked. The endpoint worked — its exact query, run against Asha M.'s live row,
returned a complete contract. The blank page was **a second, unrelated crash on the same screen**,
which the morning's fix had been sitting on top of without touching.

## What it was

`CollabDetailScreen` called a React hook **below two early returns**:

```
if (loading)        return <Spinner/>;      // first render stops here  — 8 hooks
if (error || !data) return <Error/>;
...
const {...} = useCreatorSteps();            // second render runs it    — 9 hooks
```

React counts hooks and requires the same number every render. First render 8, second render 9 →
*"Rendered more hooks than during the previous render"* → the component renders **nothing**.

It had nothing to do with her data, her stage or her campaign. It fired on **every stage, for
every creator, every time** — and had been there since Stage 3 introduced `useCreatorSteps`.

## Why the morning's fix did not catch it

The stage-vocabulary bug was real and the fix was right. But it was proved by testing the
**helpers** — `heroFor`, `sectionsFor` — and never by mounting the **screen**. So the crash
underneath survived, and the founder reported the same symptom twice.

`collabDetailModel.test.js` says this about itself, concerning a function deleted in Stage 3 for
the identical reason:

> *"the strongest argument in this repo for testing what the screen actually does rather than what
> a helper can do when fed ideal input."*

Twice in one day. So there is now a mount test — `collabDetailRenders.test.js` — that renders the
screen with the payload Asha's row actually produces, across all six stages.

## And it was not the only one

A repo-wide sweep (`src/__tests__/hooksBeforeReturns.test.js`) found three more:

| Screen | Verdict |
|---|---|
| `BrandCampaignInfluencersListScreen` | **the same live crash** — three `useMemo` below `if (loading) return`. Blank every time it was opened. **Fixed.** |
| `PayAtStoreScreen` | violation, but the condition comes from `route.params` and never changes for a mount, so React never throws. **Recorded, not fixed.** |
| `PreBookScreen` | same. **Recorded, not fixed.** |

The two follower screens sit in a named allowlist with a written reason, plus a check that fails
if either is ever fixed — an allowlist that outlives its problem quietly permits the next one.

## Verification

Both the mount test and the sweep were re-broken by putting the hook back where it was; both
failed, and named the exact file and line. Mobile suite **48 suites / 543 tests**.
