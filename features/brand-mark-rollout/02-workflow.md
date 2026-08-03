# 02 — Workflow: brand mark rollout

Success = each workflow below executes to its stated end state. "It
compiled" is not success.

## W1 — Brand sees the real logo on the web landing page

1. Visitor opens `https://inflx.in/` (dark `#070b16` hero).
2. Navbar renders the lockup: yellow mark + white "inflx".
3. Footer renders the same lockup.

**End state:** no black rectangle anywhere on the page; the wordmark is
legible white text, not a letterboxed bitmap.

## W2 — Brand sees the logo through the authenticated web shell

1. Brand opens `/login` (light ground) → lockup with **navy `#0D1630`**
   wordmark.
2. Brand signs in → `/dashboard` topbar (dark chrome) → lockup with
   **white** wordmark.
3. A rejected brand hits `/rejected` → lockup, dark tone.

**End state:** one component, three call sites, correct contrast on each;
the mark itself is identical in all three (only the wordmark colour moves).

## W3 — Browser tab carries the brand

1. Any brand-web route loads.
2. Next.js App Router serves `app/icon.png` (and `apple-icon.png`).

**End state:** tab shows the ink-tile icon instead of the default globe.

## W4 — User launches the mobile app

1. User taps the launcher icon: ink tile, yellow mark. On Android 8+ the
   adaptive icon is used, so the launcher's own mask (circle / squircle /
   teardrop) applies cleanly; on Android 13+ the themed variant is used.
2. Splash appears: ink ground, yellow-tinted glow, lockup, tagline.
3. Splash fades and hands off via `onFinish`.

**End state:** the icon and the splash are visually continuous. No
marketing screenshot, no tick bullets, no "Updated Mobile App Icon"
heading is ever shown.

## W5 — Influencer/brand sees the logo in-app

1. Unauthenticated user reaches `PhoneScreen` → lockup, dark tone.
2. Brand reaches `BrandHomeScreen` header → lockup, light tone.

**End state:** dashed `[LOGO]` placeholder is gone from every mobile
surface.

## Verification performed

- `pnpm qa` → **GREEN, 79 passed, gate 0** (zero regression).
- `Packages/Mobile` jest → **26 suites / 115 tests passed** (was 24/106;
  +2 suites, +9 tests added by this contract).
- Real-browser proof of W1 and W2: brand-web dev server started, landing
  nav/footer and `/login` captured with Playwright at DPR 2 — see
  `06-diff/notes.md`. **0 page errors, 0 console errors.**
- `/icon.png` compiled and served **200** by Next, proving W3.
- Trace fidelity: rendered back and pixel-diffed against the founder's
  original — mean abs error 1.78/255.
- Mutation check (anti-fake-green): deliberately broke the splash ground
  colour and the `md` size token → **3 of the new tests failed**, then
  reverted. The new tests bite.

## Owed before release flip

W4 is the only workflow not machine-verified here: launcher icon and
splash need eyes on a real device/emulator, and per Rule 5 a
Mobile-governed release flip needs `pnpm qa:maestro` green. `released`
stays `false` until the founder's single end-to-end pass.
