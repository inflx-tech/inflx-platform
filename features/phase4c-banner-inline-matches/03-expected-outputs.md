# Expected outputs — Phase 4c

- `tests/section-banner-gateway.test.js` — updated contract GREEN: kept
  banner carries 1–3 preview items with name + brand.name; dry/unresolved
  still dropped; static frames untouched; context-sensitivity test unchanged.
- Combined suites (banner + world-rules + allocation-live): 16/16.
- esbuild JSX parse on SectionRenderer.js; node --check on sectionEngine.
- `pnpm qa` GREEN gate 0.
- Release evidence (deferred to founder's device session): publish-ota ×3 +
  `pnpm qa:maestro` green → flip released/maestro_green in this lock.
