# Impact

**Backend only. PRODUCTION-IMPACTING: push deploys Render.**

Purely additive: one new read-only GET + a local brand-lookup helper. No existing route,
query or response shape is touched; no migration.

Risk: low — read-only, ownership-scoped, additive. Nothing consumes it yet, so it cannot
regress the UI; the frontend wiring lands separately.

Verification: pnpm qa GREEN 79/79 (gate 0) after the change; node --check on both files.
