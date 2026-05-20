# Impact analysis — maestro-first-flow

## What changes

- **`Packages/Mobile/src/config/api.js`** (GOVERNED) — refactor
  the hardcoded `USE_PRODUCTION=true` into a sibling-override
  pattern. Default returns `PRODUCTION_API_URL` for both
  `API_BASE_URL` and `BRAND_WEB_URL` exports. `ONESIGNAL_APP_ID`
  unchanged.
- **`Packages/Mobile/src/config/api-overrides.js`** (NEW, COMMITTED
  with empty defaults) — the override sibling. Default contents:
  `export default {}`. Founder edits locally + uses
  `git update-index --skip-worktree` to avoid commit pollution.
- **`qa/maestro/flows/01-follower-public-browse.yaml`** (NEW) —
  the first real Maestro flow.
- **`qa/scripts/diff-after.mjs`** (extended) — reads
  `<mockup>.maestro-flow.json` siblings, copies named Maestro
  screenshot from the latest `qa/artifacts/qa-maestro/<ts>/<flow>/`
  into `qa/artifacts/diff/<slug>/after/<mockup>.png`.
- **`LOCAL.md`** — add "api-overrides.js + skip-worktree" subsection
  under "Mobile dev with Maestro".
- **`CLAUDE.md`** — update the mobile-verify gate description
  (it's no longer infra-only).

## Blast radius

- **Production runtime (release APKs on real users):** ZERO.
  `__DEV__=false` + empty overrides → `PRODUCTION_API_URL`. Same
  URL as today's hardcoded path.
- **Render backend:** unaffected. No backend code change.
- **Vercel web:** unaffected. No web code change.
- **OTA bundle:** new JS bundle ships via `pnpm publish-ota:follower`
  (and :brand / :influencer for parity, since all three share
  `api.js`). Users open/close app twice → new bundle loaded → empty
  overrides → still hits PROD. Behaviour identical to pre-OTA.
- **Founder's local debug builds:** unchanged by default. To
  switch to LAN IP, founder edits `api-overrides.js` locally +
  uses skip-worktree.
- **The qa:maestro lane:** gains one new flow. `00-smoke` still
  passes (no change). `01-follower-public-browse` requires Metro
  running to actually pass; will fail loudly without Metro (red
  error screen, no UI text matches).

## Reversibility / rollback

- Revert the commit (api.js + api-overrides.js + LOCAL.md + flow +
  diff-after.mjs).
- Re-run `pnpm publish-ota:follower` (and others) to ship the
  reverted bundle.
- End users see no behaviour change (both pre-revert and post-
  revert builds hit PROD).
- Worst-case (something subtle): founder can ALSO hot-fix
  `api-overrides.js` to set explicit `API_BASE_URL: 'https://...'`
  if for any reason the empty-default path stops returning PROD.

## Test plan (live this turn, agent-side)

1. **Read api.js change carefully.** Confirm:
   - `import overrides from './api-overrides';` resolves at bundle
     time (no dynamic require).
   - Empty `overrides = {}` → `__DEV__` branch returns
     `PRODUCTION_API_URL` (falsy `overrides.API_BASE_URL`).
   - Non-empty override in `__DEV__` → returns the override.
   - `!__DEV__` (release) → always `PRODUCTION_API_URL`.
2. **Confirm `api-overrides.js` is valid JS** (parse via node).
3. **Confirm the new Maestro flow YAML parses** (basic YAML
   shape — Maestro will do real validation when run).
4. **Confirm `qa/scripts/diff-after.mjs`** still syntax-checks +
   the existing demo path still works (no captures configured →
   silent skip + clear log).
5. **Exercise the new mobile diff-after code path** by writing a
   `.maestro-flow.json` for the mockup and confirming
   `diff-after.mjs` finds + copies the existing
   `qa-maestro/2026-05-20_04-28-24/00-smoke/smoke-startup.png`
   as a substitute (or reports "no screenshot found" loudly).
   Goal: prove the code path works, not that the right screenshot
   shows up (the right screenshot lands after the real `01` flow
   runs).
6. **`pnpm qa`** — expect 66/C1/gate 0 unchanged.
7. **`pnpm qa:db`** — expect 382/382 unchanged.
8. **`pnpm qa:maestro`** — `00-smoke` still passes;
   `01-follower-public-browse` will probably FAIL (Metro not
   running on the agent side; debug APK can't load JS) — that's
   expected and not a regression. Note in the lock that the new
   flow's full GREEN is a founder-side verification post-OTA.

## Regression risk

- **Main `pnpm qa` and `pnpm qa:db`:** ZERO. No backend, no web,
  no shared code.
- **Maestro 00-smoke:** ZERO. No change to the flow or doctor.
- **Mobile production behaviour:** ZERO at the OTA-empty-defaults
  state. The risk is non-zero ONLY if the founder edits
  `api-overrides.js` AND commits it AND a release build picks it
  up — but release builds ignore overrides regardless (`__DEV__`
  gate). So even an accidental commit is benign for end users.
- **Founder accidentally committing his LAN IP** in
  `api-overrides.js`: mitigated by the `skip-worktree` doc in
  LOCAL.md, AND the value would be a private IP that doesn't
  expose anything sensitive even if pushed.

## Affected systems checklist

- [x] Backend runtime (Render): unaffected
- [x] DB (Supabase): unaffected
- [x] Brand-web / admin-web (Vercel): unaffected
- [x] Mobile (OTA): IMPACTED — JS bundle ships via
      `pnpm publish-ota:{follower,brand,influencer}`; behavior
      unchanged for empty overrides (default)
- [x] qa:db lane: unaffected
- [x] main pnpm qa: unaffected
- [x] qa:maestro: gains `01-follower-public-browse.yaml`
- [x] dev:doctor / db:dev:* / preview:* / diff:*: unaffected except
      diff:after now reads `.maestro-flow.json` siblings (additive,
      backward-compatible — existing capture.json path still works)
- [x] gov-check: unaffected (sub-contract 5 will enforce mockup +
      diff requirements for UI-touching releases)
- [x] Existing contracts: validate unchanged (additive)
