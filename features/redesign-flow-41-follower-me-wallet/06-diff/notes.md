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

## After-implementation screenshots (governance)
- BEFORE: this flow's mockup (`04-preview/mockups/web.html`).
- AFTER: see `me-after.png` / `wallet-after.png` in this dir (Maestro follower
  OTP-login capture on emulator-5554 against the released OTA bundle), OR — if
  emulator OTA-pull timing prevented a clean shot — documented founder physical
  APK smoke-test as the after-evidence (noted in lock.json qa_evidence).

## Sign-off
- Per-flow mockup authored + founder-signed-off via AskUserQuestion BEFORE
  implementation (corrected governance loop). Web QA + OTA: see lock.json.
