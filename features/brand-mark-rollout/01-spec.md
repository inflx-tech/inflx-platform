# 01 — Spec: brand mark rollout (web + mobile + launcher icon)

## Why

The founder supplied the finished INFLX logo mark and asked for it on web,
on mobile, and as the mobile app icon. Until now none of those surfaces
carried real artwork:

| Surface | State before this contract |
|---|---|
| `Packages/shared/components/Logo.js` (web topbar, login, rejected) | `HAS_ASSET = false` → dashed `[LOGO]` placeholder |
| `Packages/brand-web/app/page.js` ×2 (landing nav + footer) | `<img src="/inflx-logo-dark.png">` — a 1536×1024 wordmark on a **solid black** background, forced to `height:32px` |
| `Packages/brand-web` favicon | none configured at all |
| `Packages/Mobile/src/components/Logo.js` (PhoneScreen, BrandHomeScreen) | `HAS_ASSET = false` → dashed `[LOGO]` placeholder |
| `Packages/Mobile/src/screens/SplashScreen.js` | rendered `inflx-app-icon.png`, which was **not an icon** but a ChatGPT marketing-mockup screenshot carrying the heading "Updated Mobile App Icon" and green tick bullets |
| `android/.../mipmap-*/ic_launcher*.png` | stale placeholder art; no adaptive icon |

Two of those are live defects, not merely missing polish: the splash shipped
a marketing screenshot to every user on every launch, and the landing page
rendered a black rectangle on a dark hero.

Both `Logo.js` components were written as deliberate swap-ready placeholders
("flip `HAS_ASSET` when the founder uploads the artwork"). This contract is
that swap.

## Source artwork

`ChatGPT Image Aug 3, 2026, 12_27_08 PM.png` (1254×1254, re-export of
`Inflx Logo.png`). Measured, not assumed:

- mark bounding box **257×846** at x 489–745, y 163–1008 (aspect 0.30378)
- brand yellow **#FDB602**, band **#131413**, ground #FDFDFD
- geometry is non-trivial: asymmetric corner radii (large on top-left and
  bottom-right, small on the other two), a slight oblique lean, and a
  curved — not straight — diagonal band

## Decisions

1. **Lockup, not mark-alone** (founder chose). The supplied art is an icon
   mark with no wordmark, and the logo slots are wordmark-shaped. Slots
   render mark + "inflx". The wordmark is **live text** in the brand face
   (Plus Jakarta Sans 800 web / PlusJakartaSans-Bold mobile), not baked
   pixels, so it stays crisp at every size and `tone` is a pure colour swap
   with no second asset to keep in sync.

2. **Vector, not raster.** The mark is auto-traced from the founder's own
   pixels into a 2-path SVG — faithful *and* scalable. Hand-drawing that
   geometry would have produced a visibly wrong brand mark; tracing was
   validated by rendering back and pixel-diffing (mean abs error
   **1.78/255**, < 0.7%).

3. **Launcher icon: white tile, artwork untouched** — yellow bar, black
   diagonal stripe, white ground. Founder initially delegated the call and
   an ink-tile treatment was built; on review the founder restated the
   brand requirement ("it should be yellow in colour with white as
   background") and, shown both rendered at real launcher sizes and on
   simulated light/dark home screens, chose white. The trade-off is
   accepted and recorded: on a light wallpaper the white tile has little
   edge separation. Fidelity to the supplied artwork was judged to matter
   more than small-size contrast.

4. **Splash follows the icon.** White ground + the mark in its original
   colouring + navy wordmark, so the splash is continuous with the icon
   the user just tapped. The splash background is asserted equal to
   `@color/ic_launcher_background` by a test that reads the Android
   resource, so the two cannot drift.

## Non-goals

- iOS icons — the RN project has no `ios/` directory.
- Per-flavour icons. All four flavours (agency/brand/follower/influencer)
  override only `strings.xml`; they share one icon set from `main/res`, so
  one set updates all four. Left that way deliberately.
- Retiring `public/inflx-logo-dark.png` / `inflx-brand-visual.png`. Now
  unreferenced by code, but deleting them is the founder's call.
