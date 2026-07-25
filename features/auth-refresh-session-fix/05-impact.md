# Impact

**One-line verdict: zero functional disturbance for healthy sessions —
only the two failure paths change (lost-response no longer bricks;
transient no longer wipes).**

- Backend: `auth.controller.js` refresh handler — one revocation call
  removed. All roles (brand/influencer/follower/agency + brand-web
  cookie path) benefit identically. No schema change, no new endpoint,
  no envelope change. `refresh_tokens` rows now die by `expires_at`
  instead of early revocation — table growth unchanged in order of
  magnitude (INSERT-per-refresh was already the model).
- Mobile: `services/api.js` only — refresh tri-state + 30s timeout.
  All four app roles share this client. No screen code touched.
- Security posture: revoke-on-rotate without reuse-detection gave no
  real theft protection (a stolen token could simply refresh first);
  natural-expiry keeps the same 30-day exposure window. Logout
  revocation unchanged.
- Production-impacting: backend rides the next push (Render
  auto-deploy); mobile rides OTA.
