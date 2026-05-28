# Flow 41 (F2) — Before/After diff notes

## Before
- MeScreen: Wave-3 **darkColors** — ink-black bg, amber avatar (`#000` initials),
  emoji menu icons (💰📦📍👥🔖), red logout border.
- FollowerWalletScreen: Wave-4 **lightColors** — already light but `#EAB308`
  yellow, `paper`/`surface`/`yellow100` tokens, no tx icon.

## After (light brandPalette)
| Screen | After |
|---|---|
| MeScreen | light bg · white profile card with **yellow avatar tile + ink initials** + Outfit-Black name + mono phone/city · white menu card with **yellowPale MCI icon tiles** (wallet / package-variant / map-marker-outline / account-group-outline / bookmark-outline) + Outfit-Bold labels + mono uppercase subs + muted chevrons · **danger-border LOG OUT** Outfit-Black |
| FollowerWalletScreen | ink balance card (yellow #FFC107 label + white mono ₹ + pending/lifetime) · Outfit-Black "Recent activity" · tx rows with **successPale MCI gift icon** (bg2 arrow-up for redeem) + Outfit-Bold title + yellowPale CreatorChip + mono date + successText/muted mono amount · dashed yellowPale empty tile + ink/yellow "Browse partners" · bg2 "how rewards work" + yellow numbered steps |

## Per founder-signed-off design calls
| # | Decision | Implementation |
|---|---|---|
| 1 | Me menu icons = MCI in yellowPale tiles | wallet/package-variant/map-marker-outline/account-group-outline/bookmark-outline |
| 2 | After-screenshots = Maestro emulator OTP login + capture | follower OTP (000000) → Me + Wallet shots → this dir |

## Preservation evidence
- getMe / getWallet / getWalletTransactions (graceful zero-fallback) unchanged.
- logout 2-confirm Alert + AsyncStorage.multiRemove + setRole('') unchanged.
- CreatorChip (Wallet tx attribution) + negative/redeem rendering + pending/
  lifetime math preserved.
- All 5 menu nav routes unchanged.

## After-implementation screenshots (governance — REAL captures)
Captured on emulator-5554 against the LIVE released OTA bundle (follower v54,
sha256:1e09425a) via adb launch + navigation:
- **`before-app-home-dark.png`** — the real app BEFORE this redesign reached the
  device (stale pre-F0 dark Home — amber rings, dark tiles). Genuine before-state.
- **`after-home-light.png`** — Home AFTER OTA applied (F0+F1+F2 live): yellow
  story rings + ink avatars, per-business pale category tiles, light tab bar +
  MCI icons + ink-active HOME. Confirms the bundle applied.
- **`after-me.png`** — MeScreen (THIS flow): pixel-match to the mockup — Outfit-
  Black "Me", yellow avatar tile + ink "?", yellowPale MCI icon tiles
  (wallet/package/map-marker/account-group/bookmark), Outfit-Bold labels + mono
  uppercase subs, muted chevrons, danger-border LOG OUT.
- **`after-wallet.png`** — FollowerWalletScreen (THIS flow): ink balance card
  (yellow "AVAILABLE BALANCE" + white mono ₹0 + PENDING/LIFETIME), Outfit-Black
  "Recent activity", empty-state (dashed tile + 💰 + yellow "Browse partners"),
  bg2 "How rewards work" with yellow numbered steps. (Anonymous session → empty
  state; the successPale gift tx-row variant is in the mockup + code.)

Capture method = adb launch (OTA pull+apply) → tap Me tab → screenshot → tap
Wallet & Rewards → screenshot. The emulator needed a generous 2-launch cycle
(~40s) for the OTA bundle to download + apply (it was 4 bundles stale); after
that the new light UI rendered correctly. Founder physical APK smoke-test
remains the ongoing real-device confirmation.

## Sign-off
- Per-flow mockup authored + founder-signed-off via AskUserQuestion BEFORE
  implementation (corrected governance loop). Web QA + OTA: see lock.json.
