# Workflow — referral-admin-brandweb (port)

## Actor
Admin in the live admin (`brand-web/app/admin`).

## Steps
1. Admin logs into the admin they use → sidebar now shows a **REFERRALS**
   section (Settings / Relationships / Earnings / Agencies).
2. **Settings** → set default %. **Relationships** → list/create/edit/end edges.
   **Earnings** → ledger + totals. **Agencies** → approve/reject + directory.
3. Every page calls the existing `/admin/referrals/*` + `/admin/agencies`
   endpoints (unchanged).

## Success definition
- The REFERRALS section is visible in `brand-web` admin and all 4 routes
  resolve + render (empty states clean when there's no data yet).
- RBAC unchanged (API-enforced): reads any admin; %/edge writes superadmin;
  agency approve reviewer+.
- `pnpm qa` GREEN (admin nav-sweep/role-gate unregressed); brand-web builds.

## Failure / edge
- Same as the admin-web version: empty → placeholders; non-superadmin write →
  403 surfaced inline; backend error → "Failed to load".
