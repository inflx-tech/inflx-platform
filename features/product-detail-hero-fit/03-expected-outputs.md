# Expected outputs — product detail hero fit

- Manual (OTA/device): product detail hero shows the whole photo (no head/foot
  crop) in a portrait 3:4 frame; carousel swipe + dots work; food + thumbnails
  unchanged.
- esbuild JSX parse clean on ProductDetailScreen.js.
- `pnpm qa` GREEN gate 0 (RN render not covered — style/prop-only change).
- Release: OTA all audiences; Maestro on-device verify owed (no device at
  build), confirmed on the founder's device with the owed batch.
