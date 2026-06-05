# Diff notes — referral-admin-brandweb (port)

## What was implemented
The four Referral admin pages now live in the **admin the founder actually uses**
(`Packages/brand-web/app/admin/referrals/*`): Settings, Relationships, Earnings,
Agencies — plus a **REFERRALS** section in `brand-web`'s admin sidebar (after
MARKETING) and a `referralApi` namespace in `brand-web/lib/api.js`. The pages
were ported near-verbatim from the `admin-web` versions: brand-web admin uses the
**same** Tailwind tokens, the same `../../../../lib/api` import depth, and the
same `getStoredUser()` helper, so the JSX is unchanged. **No backend, no
migration** — the `/admin/referrals/*` + `/admin/agencies` endpoints already
exist and are app-agnostic.

## What matches the locked mockup
- `01-settings.html` → `/admin/referrals/settings` — default-% control + fixed
  12-month / platform-slice facts + superadmin-only save.
- `02-relationships.html` → `/admin/referrals/relationships` — edges table +
  filters + Create link + Edit %/End.
- `03-earnings.html` → `/admin/referrals/earnings` — summary totals + ledger.
- `04-agencies.html` → `/admin/referrals/agencies` — status filter + approve/
  reject + wallet/earnings/code/active-refs.
The mockups are the **same designs already approved + locked** in
`referral-admin-controls` and `referral-agency-admin`; copied here for the gate.

## What diverged from the mockup (and why)
- Nothing visual. This contract only changes **which admin app** hosts the pages
  (admin-web `/dashboard/*` → brand-web `/admin/*`). Same UI, same backend.
- The earlier `admin-web` copy is left in place (harmless duplicate; can be
  retired later).

## Why this contract exists (honest note)
Contract 2 + the Agencies page built these in `admin-web` (a second admin app
the founder doesn't use as their daily admin). The founder reported "no
Referrals tab"; root cause was the wrong host app. This port puts them where the
founder logs in. Backend was always correct.

## Things the founder should specifically check
- The **REFERRALS** section now appears in the sidebar of the admin you use,
  between MARKETING and FINANCE.
- Each page loads (empty states are expected while the engine is dormant).
- Your account: the **% / link writes need the superadmin role**; agency
  approve/reject needs reviewer+. If your daily login isn't superadmin, those
  show as view-only (API-enforced).

## After-shots
- "Before" = the reused locked mockups in `04-preview/mockups/`.
- "After" = the real `/admin/referrals/*` routes on the deployed Vercel
  brand-web (captured post-release; admin routes require an authenticated admin
  session).
