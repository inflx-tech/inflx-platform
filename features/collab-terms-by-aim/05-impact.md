# Impact

**One line: creators stop being told that commission work pays nothing.**

## Deploy class

**production-impacting** — creator app via OTA. **No backend change. No migration.**

## Blast radius (item 1)

| Area | Effect |
|---|---|
| Creator — campaign detail | Headline, terms row, accept prompt, decline wording |
| Everything else | Untouched |

## Who this reaches immediately

**Four live campaigns** are in the broken state today — 18%, 15%, 20% and 22% — every one
displaying **₹0** to the creator. Two content campaigns (₹30,000 and ₹25,000) are correct
and stay correct.

## The risk

The money shown changes on screens people accept work from. It is a **display** change —
nothing about what is owed, paid or recorded moves. The stored decline reason is
deliberately left as `fee_too_low` so no report or brand-side screen shifts under it.

The logic lives in `utils/collabPay` rather than in the screen, with 14 tests, because a
figure that decides whether someone accepts work should be checkable without a handset.

## Reversibility

Front-end only. An OTA rollback restores the previous behaviour exactly.
