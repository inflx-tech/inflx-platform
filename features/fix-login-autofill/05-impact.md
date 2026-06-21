# Impact Analysis — Fix login phone autofill

## Affected files
- Packages/brand-web/app/login/page.js — the phone `<input>` gains
  autoComplete="off", name="login-phone", autoCorrect/spellCheck off,
  data-1p-ignore / data-lpignore.

## Affected routes / APIs
None.

## Affected workflows (regression surface)
- Login OTP send/verify — unchanged (only the input's autofill attributes
  changed; value/onChange identical).

## Migration / deploy / OTA impact
- No migration. brand-web → Vercel. No backend/mobile.

## Risk notes
- Cosmetic/UX only; cannot affect auth logic. Worst case a browser still hints,
  but typing is never blocked.
