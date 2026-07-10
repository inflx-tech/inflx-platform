# Workflow Prediction — Creator Experience Studio (Phase 6)

Predicted behaviour the mockups demonstrate (confirmed against real screens in 06-diff; 6b on-device via Maestro, batched).

## Creator Studio (`creator-studio.html`, influencer app)
1. Studio → **Create Experience** → **Available Templates** (Street Style, Airport Looks, …) with their look implied.
2. Pick **Street Style** → the wizard shows the theme's known title/subtitle/CTA (nothing to write).
3. **Select products** — a grid of stockable products (contracted brands); pick 4+.
4. **Choose featured image** — from an upload or one of the picked products.
5. **Publish** — blocked if under the theme's min products or no featured image (inline reason); else "Published".
6. My Experiences list shows it as Published.

## Follower home (`follower-home-lit.html`, follower app)
1. Fashion home — the placed **Street Style** section, previously hidden, now shows **"Rahul's Street Style"** drawn by the Adaptive Renderer (Hero layout).
2. If two creators publish Street Style experiences, the section shows both (carousel).
3. Tap → the creator's experience → products → buy (existing paths).

## What this proves
The end-to-end loop closes: admin defines + places (P1-5) → creator fills (P6) → engine resolves → renderer draws → follower sees + buys. The app is a Creator Commerce platform, live.
