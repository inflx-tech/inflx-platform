# Mock UI / Screen Preview (Step 4) — backend-city-audit

Backend SQL correctness audit — no UI, nothing to mock.

Reviewer confirms at the Step-5 lock:

- This is a **proactive defensive audit** of the `city`-column
  defect class proven by the shipped fix
  `backend-defect-city-column` (`listing.service.js:201`,
  HEAD 39219e4). It hunts the *same class*, it does not presume
  more defects exist.
- **Deploy posture is CONDITIONAL:**
  - 0 genuine defects → **deploy-inert** (deliverable = the
    dispositioned inventory + qa:db evidence log; no runtime
    code change, no Render deploy).
  - A genuine latent 500 found → a **minimal column-resolution
    fix** edits backend runtime SQL → Step-14 `git push` makes
    **Render auto-deploy the backend**. That deploy fixes a real
    production 500 (desirable) but Step-14 stays an explicit,
    conscious decision — same rule as the precedent.
- Classification is grounded in the **real qa:db Postgres**
  (53 migrations), the same environment the precedent was found
  and fixed in — not static guesses. The carved candidate
  hypotheses (`creatorAnalytics:96`, `brandInbox:210`) are
  **re-proven**, and preliminary reads this session already
  suggest they are SAFE (view / correct alias) — Step 7
  confirms authoritatively.
- A genuine defect is closed by a minimal backend fix or
  **carved** as its own `backend-defect-*` contract — never by
  editing/skipping/weakening a test. Uncertainty → fail.
- "0 new defects, class CLOSED" is a **valid successful
  outcome**; the contract proves closure.

## Dispositioned inventory — Step 7 (static pass, 2026-05-18)

Schema source of truth: 53 migrations. `users`, `influencers`,
`followers`, `follower_addresses`, `creator_profiles` (+`inferred_city`),
`brand_profiles` (+`inferred_city`) and view `v_searchable_creators`
all expose `city`. **`brands` does NOT** (`001:127-144`) — brand
city lives on `users`, joined via `brands.user_id`. That single
trap is the entire defect class.

| Site (file:line) | `city` resolves via | Label |
|---|---|---|
| `services/listing.service.js:201-206` | `FROM brands b JOIN users u ON u.id=b.user_id` → `u.city` | **FIXED** (precedent HEAD 39219e4) |
| `services/proposal.service.js:31,46,159,182,204,220` | every ref → `users` alias (`u`/`inf_u`/`b_u`) joined on `user_id` | SAFE |
| `services/follower.service.js:90,128,532,572,632,792` | `u_b` = `JOIN users u_b ON u_b.id=b.user_id` in ACTIVE_CI_QUERY/FEED_QUERY | SAFE |
| `services/follower.service.js:328` | `FROM brands b JOIN users u ON u.id=b.user_id` → `u.city` (reference-correct) | SAFE |
| `services/production.service.js:99` | `JOIN users u ON u.id=inf.user_id` → `u.city` | SAFE |
| `controllers/creatorAnalytics.controller.js:41,77,96,98,100` | `FROM v_searchable_creators` (view projects `city`, `045:60/106`) | SAFE (carved hypothesis **refuted**) |
| `controllers/brandInbox.controller.js:210` | `JOIN influencers inf` → `inf.city` (`influencers.city` 003:11) | SAFE (carved hypothesis **refuted**) |
| `controllers/campaign.controller.js:141-142` | `i.city` (influencers) + `u.city` (users) — both columns exist | SAFE (carved hypothesis **refuted**) |
| `controllers/campaign.controller.js:1498,1516` | `FROM influencers i JOIN users u ON u.id=i.user_id` → `i.city` | SAFE |
| `controllers/influencer.controller.js:434,512` | `FROM v_searchable_creators` (view exposes `city`) | SAFE |
| `controllers/influencer.controller.js:561` | `FROM influencers i` → `i.city` | SAFE |
| `controllers/influencer.controller.js:593` | `FROM creator_profiles cp` → `cp.city` (024:71) | SAFE |
| `controllers/influencer.controller.js:218` | `UPDATE users SET city` | SAFE |
| `controllers/admin.controller.js:535,546,559` | `INSERT INTO influencers (… city …)` (`influencers.city` 003:11) | SAFE |
| `controllers/admin.controller.js:857,893` | `FROM brands b JOIN users u ON u.id=b.user_id` → `u.city` | SAFE |
| `controllers/follower.controller.js:36` | `FROM followers f JOIN users u ON u.id=f.user_id` → `u.city` | SAFE |
| `controllers/follower.controller.js:749,967` | `FROM brands b JOIN users u ON u.id=b.user_id` → `u.city` | SAFE |
| `controllers/follower.controller.js:1010` | JS row-property `.city` (from selected `u.city`), **not SQL** | SAFE (note: JS, not crash class) |
| `controllers/saved.controller.js:64` | `u_b` = `users` joined via brand `user_id` (feed shape) | SAFE |
| `controllers/lookbooks.controller.js:119` | `JOIN users u ON u.id=b.user_id` → `u.city` | SAFE |
| `controllers/proposal.controller.js:68` | `FROM brands b JOIN users u ON u.id=b.user_id` → `u.city` | SAFE |
| `controllers/marketingAdmin.controller.js:88,464,508,755,840` | `creator_profiles.city`/`inferred_city` (024/043) | SAFE |
| `controllers/marketingAdmin.controller.js:96,256,756,841` | `brand_profiles.city`/`inferred_city` (040/043) | SAFE |
| `controllers/brand.controller.js:147` | `UPDATE users SET … city` | SAFE |
| `controllers/follower.controller.js:56,65,227,281` | `users.city` / `followers.city` / `follower_addresses.city` | SAFE |
| `controllers/offer.controller.js:904` | selects `b.address_line AS brand_city` — no `city` column used | SAFE (not a `city`-column ref) |
| Excluded (no SQL) | `services/location.service.js` CITY_COORDS, `geocoding.controller.js`, comments, `req.body.city` JS vars | N/A |

**Static result: 0 genuine defects. The `city`-column defect
class is CLOSED — `listing.service.js:201` was the unique
codebase outlier and is already fixed (HEAD 39219e4).** Every
other site uses the correct `JOIN users … u.city` /
`influencers.i.city` / `creator_profiles.cp.city` /
view-projected-`city` pattern. Dynamic confirmation via
`pnpm qa:db` (`column "city" does not exist` must = 0) recorded
below.

## Dynamic confirmation (pnpm qa:db) — 2026-05-18 (own run)

Fresh run, real Postgres + all 53 migrations
(`db-lane.json` `generatedAt 2026-05-18T11:48:05Z`;
`db-jest.log` mtime 11:48:05Z — newer than the prior 11:21
baseline artifact, so this is THIS run's evidence, not stale):

- `column "city" does not exist` in `db-jest.log` → **0**.
- ANY `column "<x>" does not exist` (any column) → **0**.
- migrations: **53/53, 0-error**.
- backend jest: **190 passed / 192 failed / 382**
  (`Test Suites: 19 failed, 9 passed, 28 total`).
- vs post-fix baseline 190/192/382: **no regression, no
  masking** — `passed` not decreased, `failed` not increased.
  The 192 residual is the pre-existing backend-test-debt ledger
  (not city-related; zero column-resolution errors of any kind).

**Reconciliation:** static (0 defects) and dynamic (0 `city`
500s on the real 53-migration DB) **agree**. The
`column "city" does not exist` defect class is **CLOSED**.
`listing.service.js:201` was the sole codebase outlier and is
already fixed (HEAD 39219e4); no further fix exists to make.

## Deploy posture (resolved)
**DEPLOY-INERT.** 0 genuine defects → no backend runtime-SQL
change → no Render deploy. The only artefacts are this
deploy-inert contract + the dispositioned inventory under
`features/`. Main `pnpm qa` (66 / C1 gate 0) is definitionally
unaffected (no backend/qa edit; the Step-6 re-run trigger was
not met). The founder's "stop before any fix / ask before
editing runtime SQL" directive is satisfied trivially — there
is nothing to fix and no carve needed.
