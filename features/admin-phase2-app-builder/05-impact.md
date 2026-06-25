# 05 — Impact
admin-web UI rebuild; no backend schema change (Phase 1 did that), no mobile.
Consolidates two admin pages into one + retires a third (legacy
follower-categories). Risk: medium (replaces the admin surface the founder uses
to compose the app) — mitigated by reusing the existing section_config API +
keeping the app read-side unchanged. Gated on brand-web build + manual
place-a-section pass per scope.
