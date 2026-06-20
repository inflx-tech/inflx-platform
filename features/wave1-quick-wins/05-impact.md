# Impact Analysis — Wave-1 Quick Wins

## Affected files (changed)
- backend:
  - `backend/src/services/paymentConfig.service.js` — getConfig SELECT + mapping +
    env-fallback + updateConfig allowed-list extended by 12 fields. [B-3/G-1]
  - `backend/src/controllers/admin.controller.js` — updatePaymentConfig destructure +
    pass-through extended by the same 12 fields. [B-3/G-1]
  - `backend/src/routes/admin.routes.js` — mount `/categories` CRUD on the existing
    `categories.controller`. [C-1]
- web:
  - `Packages/brand-web/app/login/page.js` — cookie max-age 900 → 2592000. [A-1]
  - `Packages/brand-web/app/page.js` — remove inline brand auth widget; route CTAs to
    `/login`; clean up now-unused state/handlers/imports. [A-2]
  - `Packages/brand-web/app/dashboard/gallery/page.js` — thumbnail object-fit
    cover → contain. [E-5]
- mobile: NONE.
- shared: NONE.

## Affected routes / APIs
| Method | Path | Change | Consumers |
|---|---|---|---|
| GET | /admin/categories | newly mounted | admin web /admin/pricing/categories |
| POST | /admin/categories | newly mounted (superadmin) | admin web |
| PATCH | /admin/categories/:categoryKey | newly mounted (superadmin) | admin web |
| DELETE | /admin/categories/:categoryKey | newly mounted (superadmin) | admin web |
| PATCH | /admin/config/payments | now forwards 12 previously-dropped fields | admin payments page |

## Affected workflows (regression surface)
- Admin nav + role-gate sweeps — covered by `qa/web/admin/nav-sweep.spec.ts` and
  `qa/web/admin/role-gate.spec.ts` (incl. an assertion that `/admin/pricing/categories`
  is reachable). Confirmed GREEN (79 passed) on this changeset.
- Brand auth phone→OTP — `qa/web/brand/auth.spec.ts`. GREEN.

## Migration / deploy / OTA impact
- New migration? NO — all columns pre-exist (072/074).
- Mobile JS changed → OTA? NO — no mobile files touched.
- Backend/web only → push only (Vercel web + Render backend auto-deploy). No OTA, no APK.

## Risk notes
- No destructive ops, no data backfill, no auth-model change. paymentConfig retains safe
  fallbacks on read failure. A-2 deletes a deficient (location-less) registration path —
  a strict improvement; the canonical `/login` register (with full location capture)
  remains the only brand-register surface.
