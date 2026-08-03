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

## Follow-up — dashboard topbar reskin (founder request, same day)

Evidence: `after/dash-topbar.png`, `after/dash-full.png`.

Seeing the mark live on `inflx.in/dashboard`, the founder asked for the top
menu to lose its black strip and carry the logo alone. Four changes, all in
`app/dashboard/layout.js` plus one additive prop on the shared `Logo`:

| Element | Before | After |
|---|---|---|
| Header | `bg-[#0A0A0A]`, border `#2A2A2D` | `bg-white`, border `#E4E4E7` |
| Logo | `<Logo tone="light" size="sm">` — lockup, 26 px mark | `<Logo size="lg" wordmark={false}>` — mark alone, 42 px |
| Nav (inactive) | `#A1A1AA`, hover white on `#2A2A2D` | `#52525B`, hover `#0A0A0A` on `#F4F4F5` |
| Bell | `#A1A1AA`, hover white | `#52525B`, hover `#0A0A0A` |
| Unread badge ring | `border-[#0A0A0A]` (to punch out of the dark bar) | `border-white` |
| Sign out hover | white | `#0A0A0A` |

The active-tab pill and the avatar keep `#FFC107` with `#0A0A0A` text —
already correct on white, so they were left alone. Every remaining
`#0A0A0A` in the header block is text sitting on yellow, verified by grep.

`Logo` gained `wordmark` (default `true`), so all four other call sites —
landing nav, landing footer, `/login`, `/rejected` — are untouched and still
render the full lockup. With `wordmark={false}` the mark keeps its own
accessible label rather than being marked decorative, since it is then the
only thing naming the brand.

Deliberately **not** mirrored to `Packages/Mobile`: no mobile surface wants
a mark-only logo, and adding an unused prop there would be speculative and
would force an OTA republish for no visual change.

Verified: `pnpm qa` GREEN 79/79. Dashboard captured through the QA suite's
own brand-session helper — **0 page errors, 0 console errors**. Confirmed by
grep that no QA spec pinned the old dark chrome.

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
