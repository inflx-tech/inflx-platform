# 03 — Expected outputs

## New files

| Path | What |
|---|---|
| `Packages/shared/components/InflxMark.js` | Web mark. **Generated** 2-path SVG (silhouette + band), `height`/`fill`/`bandFill`/`decorative` props. |
| `Packages/shared/assets/inflx-mark.svg` | Canonical vector asset for design handoff. |
| `Packages/Mobile/src/components/InflxMark.js` | react-native-svg twin. Deliberately duplicated, not imported — Metro cannot resolve outside `Packages/Mobile/` (same constraint documented in `src/utils/tracking.js`). |
| `Packages/brand-web/app/icon.png`, `apple-icon.png` | Favicons (Next 14 App Router auto-detects). |
| `android/.../mipmap-*/ic_launcher_foreground.png` | Adaptive foreground, 108 dp grid, mark inside the 66 dp safe zone. |
| `android/.../mipmap-*/ic_launcher_monochrome.png` | Android 13+ themed-icon layer. |
| `android/.../mipmap-anydpi-v26/ic_launcher.xml`, `ic_launcher_round.xml` | Adaptive icon declarations. |
| `android/.../values/ic_launcher_background.xml` | `@color/ic_launcher_background` = `#131413`. |
| `Packages/Mobile/src/components/__tests__/Logo.test.js` | 7 tests. |
| `Packages/Mobile/src/screens/__tests__/SplashScreen.test.js` | 2 regression tests. |

## Modified files

| Path | Change |
|---|---|
| `Packages/shared/components/Logo.js` | Placeholder → lockup. Public API (`tone`, `size`) unchanged; `size` still `sm\|md\|lg`. |
| `Packages/Mobile/src/components/Logo.js` | Placeholder → lockup; adds `size="xl"` for the splash. |
| `Packages/Mobile/src/screens/SplashScreen.js` | Marketing-mockup `<Image>` → `<Logo size="xl">`; ground `#F5A623` → `#131413`; glow retinted yellow; dead `styles.logo` removed. |
| `Packages/brand-web/app/page.js` | Both `<img src="/inflx-logo-dark.png">` → `<Logo tone="light" size="sm">`; adds the import. |
| `android/.../mipmap-*/ic_launcher.png`, `ic_launcher_round.png` | Regenerated at all 5 densities (48/72/96/144/192). |

## Deleted files

| Path | Why |
|---|---|
| `Packages/Mobile/src/assets/images/inflx-app-icon.png` | Not an icon — a ChatGPT marketing-mockup screenshot that was being rendered on the splash. Now unreferenced; a stale copy would invite the bug back. |

## Invariants

- Mark aspect ratio pinned at **0.30378**; width derives from height, so the
  mark can never be stretched. Asserted in `Logo.test.js`.
- Splash ground must equal `@color/ic_launcher_background` (`#131413`).
  Asserted in `SplashScreen.test.js` — the two cannot silently diverge.
- Path data is generated and must not be hand-edited; both component
  headers say so.
- `Logo` falls back to `md` for an unknown `size` rather than rendering
  nothing. Asserted.
- In the lockup the mark is `decorative` (`role="presentation"`,
  `aria-hidden`) so screen readers announce "inflx" once, not twice.
