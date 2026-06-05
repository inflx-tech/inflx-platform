# referral-admin-brandweb — port the Referral admin UI to the LIVE admin

> **Correction contract.** Contract 2 (`referral-admin-controls`) and the
> Agencies page (`referral-agency-admin`) built the Referral admin UI in
> `Packages/admin-web` (`/dashboard/*`) — but the admin the founder actually
> uses is **`Packages/brand-web/app/admin/*`** (`/admin/*`, the one with
> Approvals / Marketing / Pricing / Finance). So the Referrals tab never showed
> up where the founder logs in. This contract ports those 4 pages into the live
> admin. **No backend change, no migration** — the `/admin/referrals/*` and
> `/admin/agencies` endpoints already exist and are app-agnostic.

## Problem / goal
Make the Referrals section appear in the admin the founder uses
(`brand-web/app/admin`), with the same four pages + designs already approved.

## Scope
- **In scope (frontend only, `Packages/brand-web`):**
  - `app/admin/referrals/settings/page.js` — default-% control.
  - `app/admin/referrals/relationships/page.js` — edges list + create/edit/end.
  - `app/admin/referrals/earnings/page.js` — ledger + summary.
  - `app/admin/referrals/agencies/page.js` — agency approve/reject + directory.
  - `lib/api.js`: add `referralApi` (settings/edges/ledger/summary/listAgencies/
    updateAgencyStatus) — same calls as the admin-web version.
  - `app/admin/layout.js`: add a **REFERRALS** nav section (Settings /
    Relationships / Earnings / Agencies).
  - The pages are a near-verbatim port: brand-web admin uses the **same**
    Tailwind tokens, the same `../../../../lib/api` import depth, and the same
    `getStoredUser()` role helper as admin-web.
- **Explicitly out of scope:**
  - Any backend / engine / migration change (none needed).
  - Removing the admin-web copy (left in place; harmless. Can be retired later).
  - New designs — the mockups are the **already-locked** ones from
    `referral-admin-controls` + `referral-agency-admin`, reused here.

## Surfaces touched
- **App(s):** `brand-web` admin only. **Roles:** admin (reads any admin; %/edge
  writes superadmin; agency approve reviewer+ — all enforced by the existing API).

## Data / contracts
- No new endpoints. Consumes existing: `/admin/referrals/{settings,edges,
  edges/:id,ledger,summary}`, `/admin/agencies`, `/admin/agencies/:id/status`.

## Non-functional
- **Auth gates** unchanged (API-enforced). **Failure modes** identical to the
  admin-web version (empty states, inline errors, 403 on non-superadmin writes).
- **Deploy:** `git push` → Vercel **brand-web**. No migration, no OTA, no Render
  change.
