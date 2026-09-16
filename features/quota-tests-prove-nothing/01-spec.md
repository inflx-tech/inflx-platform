# The quota tests do not test quotas

**Found:** 2026-09-16, while building `features/subscriptions-master-switch`.
**Asked for:** founder, same day — "pls fix that".

---

## 1. What is wrong

The test database is wiped before every check. The wipe also deletes the **features catalogue** —
the list of what can be limited at all (products, campaigns, sets per campaign, invitations per
cycle) — and `tests/helpers/db.js` never puts it back.

With the catalogue gone, `entitlements.getEntitlements` reads an empty map, every quota comes back
`null`, and `middleware/quotaCheck.js` treats `null` as "not configured" and lets the request
through. So in tests:

- a check that says **"the 11th product must be refused"** fails, quietly, inside the ~222
  failures the suite already carries — nobody is watching it;
- every other check that creates several products, campaigns or sets passes **only because no
  limit exists**, not because the brand is entitled to them.

The product is not affected. Production enforces limits correctly — it is what stopped the
founder adding a second set on 15 September, and the live API answers `limit: 10` for a free
brand. This is the rehearsal room, not the building.

## 2. Why the obvious fix is not enough

Reseeding `features` alone was measured on 2026-09-16: **23 green tests went red**
(222 failed / 1070 passed → 245 failed / 1061 passed).

The cause is the second half of the same gap. `subscription_tiers` IS reseeded, but
**`tier_features` — the table entitlements actually reads — is not.** So with a catalogue present
and no tier rows, every brand falls back to the *catalogue defaults* (1 campaign, 1 set, 10
products, 5 invitations) no matter which plan it is on. `registerBrand` puts test brands on
**enterprise**, which is meant to be unlimited, and they were suddenly capped at the free numbers.

So the fix is both halves, plus the caches: the catalogue and the settings are each held for 60
seconds, and the reseeded rows come back with new ids, so a reseed that does not bust the caches
is read stale.

## 3. Scope

**In scope**
- `tests/helpers/db.js`: reseed the features catalogue; reseed `tier_features` from each tier's
  `max_*` columns; bust the entitlements catalogue cache and the platform-settings cache.
- Whatever individual tests still fail afterwards, each classified and fixed on its merits.
- `tests/subscriptions-master-switch.test.js`: drop its local catalogue seeding, which only exists
  because the harness did not do it.

**Out of scope**
- Any change to `backend/src/**`. If a test fails because the PRODUCT is wrong, it gets carved as
  its own backend-defect contract and left red — never quietly fixed here.
- The ~222 failures that have nothing to do with quotas.

## 4. Success

- Every quota check in the suite is measured against a real catalogue and real tier rows.
- The suite's failure count **goes down, never up**, against a measured baseline, and no test that
  passed before fails after.
- `quotaCheck.test.js` passes in full, including "the 11th product is refused" — the check that
  has been lying.

## 5. Classification

**Deploy-inert.** `backend/tests/**` only. Nothing reaches Render, Vercel or any phone.
