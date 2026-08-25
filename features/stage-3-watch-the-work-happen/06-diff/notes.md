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
| 3 | Levels 2 and 3 gain badges, steps and level-own sections | **done** |
| 4 | Level 4 — the per-creator spine | **done** |
| 5 | Level 5 wiring, and honest notes where Stage 4/5 has not landed | **done** |
| 6 | Creator — delete the second spine, render the server's six | **done** |
| 7 | A Maestro flow over the ladder | **written, not yet run on a device** |

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

## 5. The creators with nothing to sell — asked, answered, closed

I put this to the founder as a design choice: give her page a control, or say "fix it on
the web". **Both were wrong, and the founder's reply is why:**

> "while making detailed campaign make it should be compulsory allocate products or entire
> store or category means he allocated products, then how we can say to creator you cant
> sell anything?"

Exactly right. **It IS compulsory.** Stage 2 refuses to publish a selling set with an
unallocated creator. So how did four exist?

**Checked, not assumed.** All four rows were written **21 August** — four days before Stage
2 shipped — and both campaigns have `published_at` NULL, meaning they were seeded straight
into `active` and never went through publish at all. Legacy data. No new control needed.

### But the hole they came through was still open

`invite` has **no draft guard**. A brand can add a creator to an **already-running**
campaign, and publish never fires again — so the gate never sees her. That was a live route
to exactly the state Part 4 exists to prevent.

**Closed at invite.** A selling set now refuses a creator with no allocation at the moment
the row is written, with the same wording the publish blocker uses. A cold invite is not
exempt: whether terms were settled beforehand has nothing to do with whether she has
anything on her shelf.

### And the data is fixed

`backend/scripts/fix-legacy-missing-allocation.js` — dry run by default. Set the four to
**whole store**: Kanchi is a saree house whose entire catalogue is sarees, and store scope
auto-joins anything added later, which is what briefing your own shop should mean. No
hand-picked list was guessed on anyone's behalf.

Each of the four can now sell **11 products**. Kanchi Silks' total fell from **6 to 4** —
three conversations, and Nisha's reel waiting on the brand.

### One thing my own fix broke, and I caught it

Adding the invite rule created a **third** inline copy of "what counts as a selling set" —
alongside `publishGate` and `collabOwedItems`. Three copies of one rule is how they drift,
and this particular rule decides whether someone can be contracted with an empty shelf. All
three now read one `SELLING_GOALS`, pinned by a test asserting they are literally the same
object.

## 5b. Slices 3–7 — what shipped

| Board | Built | Diverged? |
|---|---|---|
| ③ campaign-level items above the sets | `BrandCampaignSetsListScreen` | no |
| ③ set badge + six mini-bars | same screen | **yes — see below** |
| ④ set-level items above the roster | rendered on the set card | no |
| ④ creator row: step + whose turn | `BrandCampaignInfluencersListScreen` | no |
| ⑤ the per-creator spine | `BrandCreatorSpineScreen` — new | no |
| ⑥ each step opens the thing | four of six wired; two say which stage brings them | no |
| ⑤ right — her side, same six | `CollabDetailScreen` + `utils/creatorSteps` | no |
| R-8 | `qa/maestro/flows/06-brand-campaign-ladder.yaml` | no |

### The set's mini-bars show the EARLIEST step, not the commonest

The board labels them "most at step 3". As built a set shows the **lowest** step among its
creators.

**Why:** a set with one creator at step 6 and one at step 2 is a set at step 2 — that is
where the work still is. "Most" would read 6 on a two-person set and tell a brand the
opposite of the truth.

### Four steps open something, two say what they are waiting for

Steps 1, 2, 5 and 6 open the agreement, the contract, the review queue and what it earned.
Steps 3 and 4 do not, and say so:

* **3 · the shoot** — *"gets its own screen in Stage 4. Until then this is where it stands."*
* **4 · shop posts** — *"our team checks quality. You are told about posts using only your
  products, once they are live."* — badged **NOT YOURS**, and deliberately still visible.
  Hiding it would make the collaboration look stalled.

A dead tap is worse than an honest sentence.

### The roster row now opens the work, not the person

It used to open her public profile. Inside a campaign, a roster row is about **this
collaboration** — so it opens her six steps. Who she is remains a different question, one
tap further in.

### The second step model is deleted, and three tests went with it

`collabDetailModel.SPINE` and `spineFor` are gone. Their three unit tests **passed while the
thing they tested was broken in the app** — they fed `spineFor` the OLD stage names, so it
worked in the test and returned −1 on the real screen.

They are replaced by tests that pin the deletion and the replacement. That pair is the
strongest argument in this repo for testing what a screen actually does rather than what a
helper can do when handed ideal input.

---

## 6. Evidence so far

| Check | Result |
|---|---|
| The roll-up, run **read-only against production** with the new items | reconciles at every level; every `own` equals its item count |
| `qa/unit` | **zero new failures** against the HEAD baseline |
| New executing checks | **35** on the server — 22 owed items, 13 reading the tree |
| Mobile suite | **36 suites / 287 tests green**, up from 256 |
| Duplicate-route check | clean across **18 navigators** in both apps |
| Android bundle | builds, and all five new screens' copy is present in the output |
| Maestro flow | **written, not yet run** — needs a connected device |
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
