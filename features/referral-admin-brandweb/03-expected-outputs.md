# Expected Outputs — referral-admin-brandweb (port)

## Per-step
| Step | Observable output | How QA verifies |
|---|---|---|
| Nav | `brand-web` admin sidebar shows REFERRALS → Settings/Relationships/Earnings/Agencies | build route list + manual |
| Routes | `/admin/referrals/{settings,relationships,earnings,agencies}` resolve for an admin | `next build` compiles 4 routes; nav-sweep reachable |
| Settings | default-% loads + (superadmin) saves via PATCH /admin/referrals/settings | same backend as admin-web (already tested) |
| Relationships | edges list + create/edit/end via existing endpoints | backend jest already covers endpoints |
| Earnings | ledger + summary render; empty state when dormant | manual / build |
| Agencies | approve/reject + directory via existing endpoints | backend jest already covers |
| RBAC/web | route resolves for admin; redirects to /login without session | nav-sweep + role-gate GREEN |

## Data assertions
- **No backend change** — zero new endpoints, zero migration. Pages are
  read/PATCH against the already-deployed API.
- Figures equal the backend's (no recomputation) — identical to the admin-web
  version's behaviour.

## Visual evidence
- Mockups reused (already locked in `referral-admin-controls` +
  `referral-agency-admin`); copied into `04-preview/mockups/` for this contract.
- `06-diff/notes.md` before (mockup) / after (real `/admin/referrals/*` route).
- `pnpm qa` GREEN; brand-web `next build` compiles the 4 new routes.
