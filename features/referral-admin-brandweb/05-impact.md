# Impact Analysis — referral-admin-brandweb (port)

## Chat verdict (terse)
**Ports the 4 Referral admin pages into the LIVE admin (`brand-web/app/admin`)
so the Referrals tab actually appears where the founder logs in.** Corrects a
Contract-2 mistake (built in `admin-web`/`/dashboard/*` instead). Frontend-only:
no backend, no migration, no money-path change. Near-verbatim port — same
tokens, same import depth, same role helper. Production-impacting only as a
Vercel `brand-web` deploy.

## Affected files
- **brand-web (new):**
  - `app/admin/referrals/settings/page.js`
  - `app/admin/referrals/relationships/page.js`
  - `app/admin/referrals/earnings/page.js`
  - `app/admin/referrals/agencies/page.js`
- **brand-web (changed, additive):**
  - `lib/api.js` — add `referralApi`.
  - `app/admin/layout.js` — add REFERRALS nav section.

## Affected routes / APIs
- None new. Consumes existing `/admin/referrals/*` + `/admin/agencies`.

## Regression surface
- Shared `brand-web/lib/api.js` + `app/admin/layout.js` edits are additive →
  existing admin nav-sweep + role-gate Playwright specs must stay GREEN.

## Migration / deploy / OTA
- **No migration. No backend push needed** (endpoints already live). `git push`
  → Vercel **brand-web** only.
- **Deploy posture: PRODUCTION-IMPACTING** (Vercel brand-web). Low blast radius:
  additive admin pages + nav.

## Risk notes
- Token parity confirmed (brand-web admin uses the same Tailwind tokens). A
  missing token would be cosmetic only (Tailwind omits unknown utilities; no
  build break) — verified via `next build` + a screenshot.
- Reversibility: remove the nav entry / pages. Nothing persisted.
- The admin-web copy is left intact (harmless duplicate; retire later if desired).
