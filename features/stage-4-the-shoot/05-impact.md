# Stage 4 — impact

**Verdict: one additive table, one behaviour change to a live endpoint, and a screen each on
two phones. The eight coordination endpoints already exist and are untouched.**

---

## 1. Deploy classification

**Production-impacting.** Three targets:

| Target | What lands | Risk |
|---|---|---|
| Migration | `production_event_items` — additive, no backfill, no constraint that could reject a historical row | **Nil** |
| Render (`backend/src`) | the parcel endpoints, plus §2's split | **Medium** |
| OTA | **both** apps gain the shoot screen | **Medium** — new routes in two navigators |

---

## 2. The one behaviour change to something already live

**Confirming receipt will stop completing the shoot.**

Today `confirm-received` sets `status = 'completed'`. It will set `in_progress`, and the shoot
will finish when she says it is done — which is what `complete` already exists for, and what
the visit path already does.

* **Why it is safe right now:** the single live shipment (Asha's) is `confirmed` and has never
  been through this path. Nothing in production moves on deploy.
* **Where it could bite:** anything reading `production_events.status = 'completed'` to mean
  *"the goods arrived"*. **`collabStep` reads `shootDone` from exactly this field** — which is
  the field Stage 3's step number depends on. It must be re-checked, and `B-9` pins the
  outcome: a received parcel with no shoot yet must still read **step 3** on both phones.
* **Why it is worth doing anyway:** without it, a courier handing over a box advances her
  collaboration to step 4 before she has photographed anything, and both phones would agree on
  a number that is wrong.

---

## 3. What does not change

* All eight coordination endpoints — propose, accept, counter, flip, dispatch, complete,
  cancel, and the date range
* The two-day window and the two-reschedule cap
* Contract signing, and the shoot plan auto-created on signature
* Working style — Stage 1 settled it as two questions
* The product picker — **used**, not modified. This is its fourth caller, exactly as ledger
  #86 predicted

---

## 4. Rollback

| Piece | Rollback |
|---|---|
| Screens | OTA to the previous bundle. The shoot panel inside the contract page still works, so nobody is stranded |
| Parcel items | revert `backend/src`; the table is left in place, unused and harmless |
| The receipt split | revert; `completed` returns. **Check `collabStep` again on the way back** |
| Migration | leave it. An unused nullable table costs nothing, and dropping it is the only irreversible move here |

---

## 5. The real risk is the same one Stage 3 carried

New routes in **two** navigators — the change class that passes every automatic check and then
crashes on a handset.

That has now happened **three times** in this programme, and **every one was found by the
founder holding a phone** — most recently on 26 August, when a missing import crashed the
creator app on counter.

The guard added that day (`importsResolve`) covers one shape of it, and `M-10` keeps it
honest. The gate is unchanged: the founder walks both handsets, and a Maestro flow lands with
the stage.

---

## 6. Test-suite position

The backend test database has been unreachable since 2026-08-22. So every assertion in
`03-expected-outputs` §1–2 is designed as an **executing** check over the service with an
injected connection, plus read-only production queries — the same shape Stage 3 used and the
reason its reality check could be written from real output rather than from reasoning.

Certified **no-regression** against the documented baseline. **Never claimed green.**
