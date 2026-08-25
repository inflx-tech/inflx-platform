# Stage 3 — impact

**Verdict: no migration, no new endpoint, and the calculation already exists and already
reconciles against live data. This is a screen stage with one deletion in the creator app.**

---

## 1. Deploy classification

**Production-impacting**, two targets:

| Target | What lands | Risk |
|---|---|---|
| Render (`backend/src`) | the uncounted owed items at campaign and set level | **Low** — additive counting inside a service both apps already read |
| OTA | **both** apps — brand gains the ladder, creator loses its second step model | **Medium** — see §3 |

**No migration. No new table, no new column, no new route.** The tree already ships on
`GET /brands/me/inbox-summary` and the creator's on `GET /influencers/me/needs-you`.

---

## 2. The one thing that changes what a brand sees without them opening anything

**A badge appears on the brand's tab bar.** Against today's data it reads **8**.

Nothing is wrong and nothing is new — those eight things have been owed all along and the
server has been counting them since Stage 0. The change is that the brand is now told.

It is also the entry point to everything else in this stage, so suppressing it would leave a
ladder nobody is invited to climb. **Flagged in the spec as the founder's one open question.**

---

## 3. The riskiest change is a deletion

`collabDetailModel.SPINE` and `spineFor` come out of the creator app.

* **Why it is safe:** it is currently broken. `spineFor` matches stage names that Stage 1
  renamed, so `findIndex` returns `-1` and every node already renders as "todo" — no current
  step is highlighted for anything except `to_sign`. Removing it cannot make her spine less
  informative than it is.
* **Where it could bite:** `CollabDetailScreen` is her main collaboration screen. If the
  replacement fails to load, she loses a spine that at least drew six labels. So the new one
  must render from cached data when the call fails, never blank.
* **What must not change:** her Collabs **stage** grouping from Stage 1. The stage she is
  filed under and the step she is on are the same fact shown twice, and `C-4` pins that.

---

## 4. The counting changes, and what they can move

Adding campaign-level and set-level items means **badges get bigger**. Against today's data:

| Item | Would it fire now? |
|---|---|
| Wallet short | Both live campaigns have `total_budget` NULL, so no — nothing is owed |
| Never published | Both are `active`, so no |
| 30 days of zero sales | **Possibly yes** — no commission-bearing sale has ever occurred. Needs a decision on whether a campaign that never sold counts from its start date or from its first sale |
| Empty set | No — all three sets have creators |
| Everything in scope out of stock | **Probably yes for every selling set** — all 18 practice products are `is_active=false` |

So the brand's badge may jump once these land. That is honest, and it is why each item must
be **listed at the level that owns it**, not just summed — a badge whose parts cannot be
found is worse than no badge.

**The zero-sales item is the one to be careful with.** Firing it on every campaign on day one
would train a brand to ignore the number. Recommendation: count it only for a campaign that
has been active **more than 30 days** and has a creator past step 4 — a campaign where the
work happened and nothing sold — rather than one that simply started recently.

---

## 5. What does not change

* `collabStep.service` — the six steps are the agreed spine and are not being redesigned
* `collabCounts`' rule — *own plus everything beneath* — untouched
* Both existing endpoints keep their shape; the tree is additive
* Stage 2's wizard
* Brand web

---

## 6. Rollback

| Piece | Rollback |
|---|---|
| Brand ladder | OTA to the previous bundle. The existing campaign detail and roster are unchanged underneath it |
| Creator spine | OTA. **This one is not a clean revert** — reverting restores the broken spine. Prefer fixing forward |
| Extra owed items | revert `backend/src`; badges shrink back |
| Tab badge | a one-line removal if the founder wants it off |

---

## 7. Test-suite position

The backend test database has refused connections since 2026-08-22, so the API-level checks
Stage 2 could not run remain unrunnable. **Stage 3 is designed around that:** every assertion
in `03-expected-outputs` §1 is an *executing* check over `collabCounts` and `collabStep` with
a stubbed connection, plus a read-only run against production — which is how §2.1 of the spec
was written in the first place.

`R-8` adds the Maestro flow Stage 2 left owed. That is the gate on marking **either** stage
released.

Certified **no-regression** against the documented baseline. Never claimed green.
