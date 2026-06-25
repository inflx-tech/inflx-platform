# 05 — Impact
Migration 119 = additive CHECK widening (no row altered, idempotent). Engine
change = additive ctx fields existing rules ignore + brandId in cache key.
Zero behavior change to existing rules; foundation for Phases 2–5. Risk: low.
Migration applied to prod + verified (applier prints widened constraints).
pnpm qa GREEN(79); admin-sections 8/8. 3 section-engine.test fails are
pre-existing stale fixtures (not this change).
