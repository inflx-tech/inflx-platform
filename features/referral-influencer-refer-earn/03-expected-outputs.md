# Expected Outputs — referral-influencer-refer-earn (Contract 4)

> Defined BEFORE coding. jest + Maestro assert against these.

## Per-step expected outputs
| Step | Observable output | How QA verifies it |
|---|---|---|
| EP1 | `GET /influencers/me/referral` → `{ code:/^INFLX-/, earned_total:0, window_months:12, referred_count:0, ledger:[] }` for a fresh influencer | jest: register influencer, GET, assert shape + stable code on 2nd call |
| EP2 | After an influencer-referrer accrual (engine), GET → `earned_total` = sum of paid ledger amounts; `ledger[0]` has `referred_name, source, amount, payout_status:'paid'`; `referred_count`=#distinct active edges | jest: seed edge + accrue, assert totals + row |
| EP3 | RBAC: non-influencer (brand) → 403; another influencer sees only their own rows | jest: role + isolation |
| Screen | ReferAndEarnScreen shows code + Copy + Share + earned hero + ledger; empty state when ledger=[] | mockup-locked design; manual/Maestro boot |
| Gate | influencer app boots + bundles with the new screen → `02-influencer-launch.yaml` GREEN | `pnpm qa:maestro` on emulator-5554 w/ influencer APK |

## Data assertions
- `GET /influencers/me/referral` is **read-only** (no writes except the lazy
  `getOrCreateCode` insert on first call).
- `earned_total` equals `influencers.referral_earned_total` exactly (no
  recomputation); `ledger.amount` equals stored `referral_ledger.amount`.
- Isolation: an influencer's `ledger` contains only rows where
  `referrer_type='influencer' AND referrer_id = <their influencer id>`.
- No change to wallet/accrual/withdrawal behaviour (C4 is read + UI only).

## Visual evidence required (UI-governed + Mobile-governed)
- `04-preview/` phone-sized mockup of ReferAndEarnScreen (code/copy/share +
  earned hero + how-it-works + ledger + empty state), mockup-locked before any
  `Packages/Mobile/src/**` code.
- `06-diff/notes.md` before (mockup) / after (emulator screenshot or Maestro
  `takeScreenshot`) signed off before deploy.
- `release.maestro_green: true` in lock.json (gov-check Rule 5) — set after
  `pnpm qa:maestro` GREEN.
- `pnpm qa` GREEN (backend + web unregressed).
