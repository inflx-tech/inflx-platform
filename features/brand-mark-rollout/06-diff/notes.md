# 06 — Before / after notes

Captures in `after/`. Web shots are Playwright at DPR 2 against the real
brand-web dev server (not the mockup), so they are evidence of the shipped
component, not of the preview.

| File | What it shows |
|---|---|
| `after/web-nav.png` | Landing navbar, real page |
| `after/web-login.png` | `/login` logo, real page |
| `after/final-icons.png` | Generated launcher icons at true sizes, square + round |
| `after/compare.png` | Trace fidelity: original ¦ traced ¦ 8× amplified diff |

## P1 — Landing navbar ✅ matches prediction

**Before:** `<img src="/inflx-logo-dark.png" style="height:32px">` — a
1536×1024 wordmark baked onto a **solid black** background, letterboxed into
a 32 px strip on a `#070b16` hero. It read as a black rectangle with a
smudge, and the bitmap wordmark carried a drop shadow.

**After:** crisp yellow mark + white "inflx" in Plus Jakarta Sans 800. No
raster, no black box. Two 537 KB image requests removed from the page.

## P3 — `/login` ✅ matches prediction

Yellow mark with its black band, navy `#0D1630` wordmark on the light
ground. Measured box **83.78 × 34 px**. Confirms the tone swap moves only
the wordmark colour — the mark is byte-identical between the two panels.

**0 page errors, 0 console errors** on both routes.

## P5 — Favicon ✅

Next compiled `/icon.png` and served it **200** (`Compiled /icon.png in
300ms`). Previously no favicon resource existed at all.

## P6 — Launcher icon ✅ artwork only

`after/final-icons.png` shows all five densities, square and round, on a
neutral strip so the white tile edge is visible. The mark ships in its
original colouring — yellow bar, black stripe — on a white ground.

**How the ground was settled:** an ink-tile version was built first under
delegated authority. The founder reviewed and restated the brand
requirement (yellow mark, white background), so `after/compare-options.png`
was produced — both grounds at real launcher sizes plus simulated light and
dark home screens — and white was chosen with the light-wallpaper trade-off
explicitly on the table. Full reasoning in
`04-preview/workflow-prediction.md`.

**Known trade-off, accepted:** on a light wallpaper the white tile has
little edge separation. No border was added, because that would alter the
supplied artwork.

## P7 — Splash ✅ artwork only

**Before — this is the real defect:** the splash rendered
`src/assets/images/inflx-app-icon.png`, which was never an icon. It was a
1536×1024 ChatGPT marketing mockup: a rounded yellow tile with a white
"lx" glyph, under the heading **"Updated Mobile App Icon"**, above green
tick bullets reading "Clean, bright yellow background", "Simple &
gradient-free", "Highly recognizable". `resizeMode="contain"` inside a
120×120 box shrank the whole screenshot — headline, ticks and all — into
the splash. Every user saw it on every launch.

**After:** white ground, pale yellow glow, the real lockup with the navy
wordmark, tagline in navy at 55%. The asset is deleted, so it cannot come
back by accident, and a test fails if any `<Image>` reappears on that
screen.

The splash background is no longer a hardcoded twin of the icon colour: the
test **reads `values/ic_launcher_background.xml`** and asserts the splash
uses whatever that resource says. Mutation-checked — recolouring the icon
resource alone fails the test.

## Trace fidelity

`after/compare.png` — original ¦ traced ¦ 8× amplified diff. The diff is
blank except hairline edges, i.e. sub-pixel antialiasing only. Mean abs
error **1.78/255 (<0.7%)** across the full 257×846 mark.

## Not captured — owed before release

P2 (footer) is the same component and size as P1. P4 (dashboard topbar)
sits behind auth and was not captured. **P6 and P7 have no on-device
capture** — launcher masking and splash timing need a real device or
emulator, and Rule 5 requires `pnpm qa:maestro` green before
`release.released` flips. That flip is deliberately deferred to the
founder's single end-to-end pass.
