# Stage 2 — impact

**Verdict: one additive migration, one changed rule that brand-web leans on, and a large
amount of new phone screen. Nothing outward-facing. Nothing a creator or shopper sees change
until a campaign is published the new way.**

---

## 1. Deploy classification

**Production-impacting.** Three targets:

| Target | What lands | Risk |
|---|---|---|
| Migration | `campaign_sets.channels_json` — additive JSONB, nullable, no default, no constraint | **Nil.** No backfill, no existing row touched |
| Render (`backend/src`) | Derived `set_budget`; four new publish blockers; one new brand-auth preview endpoint | **Medium** — see §2 |
| OTA (brand app) | The wizard, the merged picker, the two re-pointed callers | **Medium** — see §3 |

**No creator-app change. No follower change. No admin change.**

---

## 2. The one change that reaches an existing surface

**`set_budget` stops being required and starts being derived** (spec §5.2).

Brand-web's wizard types a set budget and posts it. After this change the server recomputes
that column from the sum of the set's agreed fees on every invite and every set write.

* **Why it is safe:** web computes and shows the same sum today. The server will overwrite
  the typed value with the number web already displayed. The visible outcome is unchanged.
* **Where it could bite:** a brand who typed a set budget *different* from the sum of the
  fees. Today that discrepancy is stored; afterwards it is corrected. In production there
  are currently **no** engagement/hybrid sets built this way that would move — but this is
  the assertion to re-run against live data on the day, not to assume.
* **The validation that disappears:** `'set_budget is required for engagement and hybrid
  goals'`. Any client still sending one is accepted; any client omitting one now succeeds.
  Strictly loosening, so no existing caller can start failing.

**This is the only thing in the stage that changes behaviour for a surface not being
rebuilt.** Everything else is additive.

---

## 3. The four new publish blockers

These are the commercially important half of the stage, and they are also the change most
likely to surprise: **a campaign that publishes today may refuse to publish afterwards.**

That is the point. The states they refuse are:

| Refused state | What it does today |
|---|---|
| A creator on a sales set with `alloc_scope IS NULL` | Publishes. She is contracted and **invisible in the shopping app** — she has nothing to sell |
| A sales/hybrid set with no offer for a creator | Publishes. A shopper has no reason to buy through her rather than walk in |
| An agreement that lapsed between ticking and publishing | Publishes against terms that are no longer live |
| An offer scoped to a product not in the live catalogue | Publishes. The discount can never fire |

Production check before deploy: `P-03` and `P-06` in `Docs/TEST_PLAN_PARTS_1_TO_6.md` were
both **PASS** on 2026-08-12 — 19 live collaborations, 0 on the legacy fallback, 0 stranded.
So no live campaign is in a state these blockers would have refused. **Re-run before the
go**, because the practice world was rebuilt since.

---

## 4. What does not change

* `campaignRollup` — untouched. The campaign total is still the sum of paid set budgets;
  the end date is still NULL whenever any set is `conversion`
* The agreement consumption transaction — untouched. It stays inside `invite`, guarded by
  `WHERE status='ready'`, and the phone simply does not invite until publish
* `offerResolution.resolveBestOffer` — untouched. The new preview endpoint is a door onto
  it, not a second copy of the maths. This is deliberate: a preview that can disagree with
  checkout is worse than no preview
* `collabTerms.model.js` and the aim vocabulary — untouched
* The creator's one-click accept on an agreement-backed invite — untouched
* Brand web's screens — untouched

---

## 5. Rollback

| Piece | Rollback |
|---|---|
| Phone wizard | OTA to the previous bundle. The web link it replaced still works, so the brand is never stranded |
| Publish blockers | Revert `backend/src`; the states they refuse simply publish again |
| Derived `set_budget` | Revert `backend/src`; web's typed value stands again |
| `channels_json` | Leave it. An unused nullable column costs nothing, and dropping it is the only irreversible move in the stage |

---

## 6. What this stage costs in risk terms

The largest risk is **not** the backend. It is that this stage adds a deep new route tree to
a native stack — the exact change class the Stage 1 handover names as *"passes every
automatic check and then crashes on a real device"*, skipped six times running.

So the gate is unchanged and non-negotiable: **the founder walks it on a handset before any
deploy is requested**, and the duplicate-route check runs across every stack in both apps.

---

## 7. Test-suite position

The repo carries **93 pre-existing failures** (`project_test_suite_debt`). This stage will be
certified **no-regression against that baseline**, measured like for like on serial runs.
It will not be claimed green, because the suite has never been green.

The backend test database has been unreachable since 2026-08-22 (Stage 1 handover §4.2).
If it is still down when this stage is implemented, the backend half is verified **against
production directly** — stronger for the specific changed queries, and **not** the broad
did-anything-else-break sweep. That distinction gets stated in `06-diff/notes.md`, never
blurred.
