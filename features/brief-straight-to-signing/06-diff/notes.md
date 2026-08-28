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
