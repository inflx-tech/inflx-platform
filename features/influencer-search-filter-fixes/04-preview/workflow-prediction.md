# 04 — Workflow prediction

Stated before the diff is captured.

## Chip row

- With no tier filter: **All 69 · Nano 13 · Micro 30 · Mid 13 ·
  Macro 11**. The All count matches the header's "69 searchable"
  exactly — before, the header said 69 while All said 50.
- Selecting any tier leaves **all five chips visible with unchanged
  counts**. Only the active styling moves. One click switches tier.
- City = Vijayawada: Nano renders **dimmed and disabled at 0**, not
  removed.

## City filter

Type a city and the list settles on that city's creators and stays
there. The specific thing to watch: type reasonably fast, then wait.
Before, an in-flight earlier request could repaint the full list a
second or two after the correct result had already rendered — which is
what made the filter look dead.

Vijayawada should settle on **6**, Nellore on **16**.

## Explicitly NOT predicted

- **A bigger result set from city filtering.** 37 of 73 creators have
  no city recorded, so city filters will still feel aggressive. That
  is data coverage, and this contract does not change it.
- **Tier counts summing to the All count.** Two creators have a NULL
  tier, so 13+30+13+11 = 67 against an All of 69. That is correct, not
  a rounding error.
- **Faster search.** The cold-start latency is unchanged; the race is
  what is fixed.
