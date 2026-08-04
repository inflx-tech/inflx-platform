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

## Follow-up 2 — the mark becomes the letter "i" (founder request)

Evidence: `after/letterform.png` (the design study), `after/new-landing-nav.png`,
`after/new-login.png`, `after/new-topbar.png`, `after/cmp-out.png`.

Founder: *"our logo symbol will act as Letter 'I', don't add I again in name
inflx"*, plus a new splash caption.

**Before:** `[mark] + "inflx"` — the "i" was written twice, once as the
symbol and once as a letter, with the symbol standing apart as a badge.
**After:** `[mark] + "nflx"` — the name is spelled once and the symbol is a
letter inside the word.

### Metrics, measured not guessed

Plus Jakarta Sans 800 was measured two independent ways — Canvas
`TextMetrics` in a browser and glyph outlines via opentype.js — and they
agree, so the numbers are trustworthy:

| | browser | TTF | used |
|---|---|---|---|
| "i" height (with dot) | 0.750 em | 0.745 em | — |
| "f"/"l" ascender | 0.760 em | 0.757 em | **mark height** |
| "n" x-height | 0.560 em | 0.558 em | — |
| "i" advance | 0.260 em | 0.260 em | **mark slot** |

The mark's aspect is 0.30378, so at ascender height it is **0.2299 em**
wide against the "i" advance of **0.260 em** — it drops into the word
almost exactly, with 0.015 em of side bearing each side reproducing the
word's natural rhythm. The substitution is metrically natural, not forced.

Founder chose **Option C** from a three-way study (A = i-height 0.75F,
B = proud 0.84F, C = ascender 0.76F): mark top flush with the "f" and "l",
giving the word one clean top edge.

### Why outlines instead of live text

This is the significant engineering change, and it is a direct consequence
of the design: as a **letter**, the mark's position depends on exact glyph
metrics. Web loads Plus Jakarta Sans **800**; mobile bundles only
**Bold 700**. Live text would therefore letterfit differently on the two
platforms — and a font that failed to resolve on a phone would drop the
mark into the wrong place *inside* the word, which is far more damaging
than a symbol sitting slightly off *beside* it.

So the wordmark now ships as glyph outlines in `InflxLockup` (694 chars of
path data). Consequences, all good:

- byte-identical logotype on web and mobile — this also **fixes a latent
  inconsistency**, since web was rendering the word at 800 and mobile at 700
- no font dependency at all for the logo
- ships over **OTA with no APK round** (adding an ExtraBold TTF to mobile
  would have required one)
- `tone` still works — the word is one `<path>` whose fill is the prop

Verified the outline version reproduces the approved live-text design:
rendered both at ascender height 120 and compared ink boxes — height
identical (240 px), width within **0.9 %** (browser subpixel/hinting vs raw
advances).

### Accessibility

The brand name no longer exists as text anywhere in the tree, so the
lockup carries `aria-label="inflx"` on web and `accessibilityLabel="inflx"`
on mobile. Confirmed live: the `/login` lockup reports accessible name
**"inflx"**. A test asserts the label, and another asserts no literal
"inflx" text node survives — that one fails if the double-i ever returns.

### Caption

`"Connecting Brands & Influencers"` → **"Powered by Creators, Driven by
Community"**. Founder confirmed both halves capitalised.

### Scope

Applied to all 7 lockup call sites (splash, phone screen, brand home,
login, landing nav, landing footer, rejected ×2) — founder chose
brand-wide over splash-only, so the name is never spelled two ways.
Unaffected: dashboard topbar (mark alone), launcher icon, favicon.

Mobile `Logo` deliberately has **no** `wordmark` prop, unlike the web twin —
no mobile surface needs a mark-only logo. Noted in both headers.

Verified: `pnpm qa` GREEN 79/79; Mobile jest 26 suites / **118 tests**;
landing nav, `/login` and the dashboard topbar captured on the running app
with **0 page and 0 console errors**.

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
