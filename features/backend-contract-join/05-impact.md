# Impact

**Backend + brand-web. PRODUCTION-IMPACTING: pushing deploys Render (backend) and Vercel (web).**

- Backend delta is one added SELECT column — additive, no filter/shape change, no migration.
- Frontend prefers the id and keeps the handle fallback, so old and new payloads both work.

Risk: low, but money-adjacent (the Contracts tab locks funds on counter-sign), which is exactly
why the fragile string join was worth fixing.

Verification: pnpm qa GREEN 79/79 (gate 0) + next build clean.
