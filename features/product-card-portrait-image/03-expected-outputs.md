# Expected outputs — product card portrait image

- Manual (on-device / OTA): fashion/beauty/furniture product cards show the
  full product photo in a portrait 3:4 frame; no top/bottom slice. Detail page
  unchanged. Food unchanged.
- esbuild JSX parse clean on ShelfProductCard.js.
- `pnpm qa` GREEN gate 0 (RN render not covered by qa — style-only change,
  no logic/import change).
- Release: OTA publish (all audiences); Maestro on-device verify recorded as
  owed (no device at build), flipped after founder's device confirmation.
