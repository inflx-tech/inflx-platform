# 04 — Workflow prediction

What the mockup (`mockups/brand-mark.html`) claims will happen once the
change lands, written **before** the after-capture so the two can be
compared honestly.

The mockup is not a hand-drawn approximation: it inlines the same traced
path data the components ship and embeds the same generated launcher PNGs
from `android/.../mipmap-*/`, so preview and reality cannot drift.

## Predictions

| # | Surface | Prediction |
|---|---|---|
| P1 | Landing navbar (`/`, dark `#070b16`) | Yellow mark + **white** "inflx", mark ~26 px tall, replacing a black rectangle. |
| P2 | Landing footer | Same lockup, same size. |
| P3 | `/login` (light ground) | Yellow mark + **navy `#0D1630`** wordmark, ~34 px mark. |
| P4 | Dashboard topbar (dark chrome) | Same lockup, white wordmark, `size="sm"`. |
| P5 | Browser tab | Ink-tile icon served from `app/icon.png`. |
| P6 | Launcher icon | White tile, mark in its original colouring (yellow bar, black stripe); round variant is a true circle. |
| P7 | Splash | White ground, pale yellow glow, lockup at `size="xl"` (64 px mark) with navy wordmark, tagline at 55% navy. |

## Explicitly *not* predicted here

P6 and P7 are predicted as artwork only. Whether Android's launcher mask,
the adaptive-icon safe zone and the real splash timing look right **on a
physical device** is not something this mockup can prove — that is the
Maestro / on-device step owed before the release flip.

## Icon ground — how it was settled

Three grounds were built and rendered at real launcher sizes and on
simulated light and dark home screens:

| Ground | Outcome |
|---|---|
| Yellow tile, dark mark | Rejected. The mark is 0.30 aspect, so it read as a small dark element in a large empty yellow field, with the stripe nearly invisible at 48 px. |
| Ink tile, yellow mark | Built first under delegated authority; strongest at 48 px and on any wallpaper, but inverts the artwork's ground. |
| **White tile, artwork untouched** | **Shipped.** Founder reviewed the renders and restated the brand requirement — yellow mark, white background. |

The founder saw the ink and white options side by side, including the
light-wallpaper case where the white tile loses its edge, and chose white
with that trade-off understood. Fidelity to the supplied artwork outranked
small-size contrast. Reversible by changing `GROUND` in the icon generator
and the one colour in `values/ic_launcher_background.xml` — the splash
follows automatically, because a test binds it to that resource.
