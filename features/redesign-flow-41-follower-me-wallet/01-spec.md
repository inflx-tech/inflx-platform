# Flow 41 (F2) — Follower Me + Wallet · Spec

**Bucket**: mobile-follower redesign (Wave 3) — Phase F2 (account + wallet), 1st flow
**Owner**: founder · **Locked**: 2026-05-28 (founder signed off the per-flow mockup via AskUserQuestion)

## 1 · Problem
The account hub (MeScreen, darkColors) and the rewards wallet
(FollowerWalletScreen, lightColors `#EAB308`) are off the F0-locked light
brandPalette. MeScreen also uses emoji menu icons inconsistent with the MCI
nav icons used across the redesigned apps.

## 2 · Goal
Apply the F0 light brandPalette to both account screens. Per-flow mockup
authored + **founder-signed-off before implementation** (full governance:
mock → agree → implement → after-screenshots).

## 3 · Scope
### In-scope
- `screens/follower/MeScreen.js` (147) — dark→light flip + MCI menu icons (founder design call) + yellow avatar + danger logout
- `screens/follower/FollowerWalletScreen.js` (293) — lightColors→brandPalette + successPale MCI gift tx icon
### Out-of-scope
- SavedScreen / FollowedInfluencers / Address / OrderHistory / OrderDetail → later F2 flows
- Backend / API / navigation / tracking — untouched

## 4 · Dependencies
- `getMe()` (Me) · `getWallet()` + `getWalletTransactions()` (Wallet, graceful zero-fallback)
- AsyncStorage logout (multiRemove + setRole) · CreatorChip component (Wallet tx)
- 5 menu nav routes: FollowerWallet / OrderHistory / Address / FollowedInfluencers / SavedList

## 5 · Risk surface — LOW
- Pure restyle. Me dark→light is a clean token-swap-equivalent rewrite (no white-on-dark hazards: avatar initials were `#000` on amber → ink on yellow). Wallet lightColors→brandPalette mostly identical hexes + warmer yellow.
- getMe/getWallet/logout/CreatorChip/negative-tx/pending-lifetime math preserved.

## 6 · Governance (the corrected loop — enforced from this flow)
1. ✅ Per-flow HTML mockup authored (`design/wave3/flow-41-follower-me-wallet/web.html`)
2. ✅ Founder sign-off via AskUserQuestion (2 design calls: MCI icons + Maestro screenshot method)
3. → Implement (this step)
4. → **After-implementation screenshots**: Maestro follower OTP login (000000) → screenshot Me + Wallet → `06-diff/`
5. → Web QA + OTA + close-out

## 7 · Success criteria
1. Both screens light brandPalette; MeScreen MCI menu icons.
2. Zero API/nav/tracking change.
3. `pnpm qa` 76/76 GREEN.
4. After-screenshots captured into 06-diff (Maestro or documented fallback).
5. OTA × 3.
