# Stage 3 — before and after

**Live document.** Started 2026-08-26 after slices 1–2. Updated as each slice lands.
What was promised, what was built, **what diverged**, and what to check.

Board: `04-preview/mockups/stage3-screens.html` —
`pnpm preview:open stage-3-watch-the-work-happen`.

---

## Progress

| Slice | What | State |
|---|---|---|
| 1 | Server — the campaign-level and set-level owed items | **done** |
| 2 | Brand reads `needs_you` — tab badge, campaign badges | **done** |
| 3 | Levels 2 and 3 gain badges, steps and level-own sections | not started |
| 4 | Level 4 — the per-creator spine | not started |
| 5 | Level 5 wiring, and honest notes where Stage 4/5 has not landed | not started |
| 6 | Creator — delete the second spine, render the server's six | not started |
| 7 | A Maestro flow over the ladder | not started |

**Nothing is deployed.**

---

## 1. Slice 1 — what shipped

| Board | Promised | Built | Diverged? |
|---|---|---|---|
| ③ campaign-level items | wallet short · never published · 30 quiet days | `collabOwedItems.forCampaigns` | no |
| ④ set-level items | no allocation *(existed)* · empty set · nothing to buy · offer expiring | `collabOwedItems.forSets` | **yes — see §3.1** |

### The shape changed, not just the count

`own` used to be a bare integer — and on a set it counted **creators**. It is now the
**length of a list of items**, and the list ships with the tree.

This is not cosmetic. FINAL 4's rule is that tapping a number gets you to a button every
time, and a screen cannot do that if it was only told "2". It also changes arithmetic: a set
with three unallocated creators used to read **3**; it now reads **1** — *one thing to fix,
which names three people*. That is the honest number, because there is one button.

---

## 2. Slice 2 — what shipped

| Board | Promised | Built | Diverged? |
|---|---|---|---|
| ② tab-bar badge | one number spanning Campaigns and Creators | `BrandNavigator` via `useNeedsYou` | **yes — see §3.2** |
| ② campaign row badge | everything owed inside that campaign | `BrandCampaignListScreen` | no |
| — | the app stops discarding the tree | `utils/brandNeedsYou` — one shared fetch | no |

**The grep that returned zero hits now returns hits.** `GET /brands/me/inbox-summary` has
carried the whole tree since Stage 0; two screens called it and neither read it.

**It never fakes a zero.** A failed call keeps the last known tree and sets a flag. A badge
of 0 must mean *"nothing is owed"*, never *"we could not ask"* — a brand told zero stops
looking.

---

## 3. What diverged, and why

### 3.1 The badge is per ITEM, not per creator

Described above. The board draws a set badge of 3 in a worked example; against real data the
same situation now reads 1. The board's *rule* — a number decomposes into things you can act
on — is honoured more exactly by items than by a headcount.

### 3.2 TWO tab badges, not one

The board says the tab-bar badge is *"the only number that spans both halves"* — one number,
8. As built there are **two**: Campaigns carries 5 and Creators carries 3.

**Why:** React Navigation puts a badge on a *tab*, not on the bar. A single 8 would have to
live on one of the five tabs and would then be wrong for that tab — a brand tapping
Campaigns expecting 8 things would find 5. Splitting it keeps every badge true about the
thing it sits on, and 5 + 3 is still visibly 8.

**This is a real divergence from a locked board and is the first thing to judge on the walk.**

---

## 4. The practice shelf, stocked

Founder, same day: *"you turn it on all those products … as well as add dummy images,
categories as well for look and feel as real ones."*

`backend/scripts/seed-practice-product-shelf.js` — dry run by default, `--apply`, `--revert`.

```
BEFORE: total 18 · active 0  · pushed 0  · with_image 0  · categorised 0
AFTER : total 18 · active 18 · pushed 18 · with_image 18 · categorised 18
```

* **Scoped to `(practice)` brands only.** The script refuses to run if that set is empty;
  verified afterwards that **0** non-practice products were altered.
* **Categories are real leaves from the live tree, matched on the product name.** All eleven
  Kanchi products are sarees and are filed as *Saree* rather than spread around to make the
  picker look busier. The script **refuses to run** if any product matches no rule — a
  product filed nowhere lands silently under "Other" and nobody notices.
* **Images are stock photography**, deterministic per product so the same picture appears
  every time on every device. **Not these products.** Swapping for real photography is one
  UPDATE.
* **Outward-facing, deliberately.** `is_active` + `pushed_to_store` is what puts a product
  into follower discovery, so the practice brands are now publicly browsable in the shopping
  app. A walk against an empty shop proves nothing.

**Effect, measured:** the roll-up re-run against production — `NOTHING_TO_BUY` correctly
stopped firing on both selling sets, Kanchi Silks fell from **8 to 6**, and it still
reconciles at every level.

---

## 5. A finding the seeding did NOT fix

**`NO_ALLOCATION` still fires on four live collaborations, and there is no button.**

Those campaigns are **active**. Allocation is written at invite time by the Stage 2 wizard,
and `updateInfluencer` refuses anything that is not a draft. So the item correctly names a
real problem the brand **cannot fix from the phone** — which breaks FINAL 4's rule that a
badge can always be walked down to a button.

Two honest answers, and the choice is the founder's:

1. The creator's spine gains a control that sets allocation on a **live** collaboration.
2. The item says plainly that this one is fixed on the web.

**Neither invented.** Flagged for slice 4 or 5.

---

## 6. Evidence so far

| Check | Result |
|---|---|
| The roll-up, run **read-only against production** with the new items | reconciles at every level; every `own` equals its item count |
| `qa/unit` | **zero new failures** against the HEAD baseline |
| New executing checks | **35** — 22 on the owed items, 13 on reading the tree |
| Mobile suite | **35 suites / 269 tests green**, up from 256 |
| Android bundle | builds |
| Backend suite | **NOT RUN** — the test database has refused connections since 2026-08-22 |

Backend verification is by the 35 executing checks plus read-only production queries for
every changed statement. Stronger for those statements, and **not** the broad
did-anything-else-break sweep. Not claimed as one. **Not claimed green.**

---

## 7. What to check when the walk comes

1. **The two badges** (§3.2) — is 5 + 3 clearer than one 8, or worse?
2. **Whether 6 is a welcome number** or reads as six problems.
3. **The four creators with nothing to sell** (§5) — the item is right; the missing button
   is the question.
4. **The pictures** — stock photos on a saree may read as wrong rather than as placeholder.
