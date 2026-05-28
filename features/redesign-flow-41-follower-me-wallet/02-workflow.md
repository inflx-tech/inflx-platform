# Flow 41 (F2) — Workflow

**Actor**: Follower (logged-in).

## A · MeScreen
- `useFocusEffect` → `getMe()` → profile (follower).
- Renders: "Me" title · white profile card (yellow avatar tile + ink initials +
  Outfit-Black name + mono phone/city) · white menu card with 5 rows (yellowPale
  MCI icon tile + Outfit-Bold label + mono uppercase sub + chevron): Wallet &
  Rewards → FollowerWallet · My Orders → OrderHistory · My Addresses → Address ·
  Following → FollowedInfluencers · Saved Offers → SavedList · danger-border LOG OUT.
- Logout: 2-confirm Alert → AsyncStorage.multiRemove(['inflx_token','inflx_refresh_token','inflx_user']) → setRole('').
- Restyle: darkColors → brandPalette; emoji → MCI (wallet / package-variant /
  map-marker-outline / account-group-outline / bookmark-outline).

## B · FollowerWalletScreen
- `getWallet()` + `getWalletTransactions()` (Promise.all, graceful zero-fallback).
- Renders: app bar · ink balance card (yellow label + white mono ₹ + pending/
  lifetime breakdown) · "Recent activity" · tx rows (successPale MCI gift icon /
  bg2 arrow-up for redeem + Outfit-Bold title + CreatorChip + mono date +
  successText/muted mono amount) · empty state (dashed yellowPale tile + ink/
  yellow "Browse partners") · bg2 "how rewards work" card with yellow numbered steps.
- Restyle: lightColors → brandPalette (yellow #EAB308 → #FFC107, paper → white,
  surface → bg2, yellow100 → yellowPale, success → successText).

## Success state
Account hub + wallet on the unified light creator-vibe language; all data,
logout, follow-through routes, and reward math unchanged.
