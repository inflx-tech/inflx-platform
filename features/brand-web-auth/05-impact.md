# Impact Analysis — Brand-web auth (phone → OTP)

## Affected files
- Reference workflow only — no application code changed. The
  implementation (`Packages/brand-web/app/login/page.js`) predates
  this contract; this folder retro-documents it as the worked example.

## Affected routes / APIs
| Method | Path | Change | Consumers |
|---|---|---|---|
| POST | /v1/auth/send-otp | none (observed) | brand-web `/login`, mobile auth |

## Affected workflows (regression surface)
- Any future change to `app/login/page.js` or `lib/api.js` must keep
  `qa/web/brand/auth.spec.ts` green.

## Migration / deploy / OTA impact
- None. QA-foundation only — no migration, no OTA, no APK.

## Risk notes
- None. Deterministic (API stubbed).
