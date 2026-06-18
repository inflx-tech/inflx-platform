# 02 — Workflow

## User flow (unchanged except the Returns destination)
1. Follower taps Profile tab → MeScreen (`ProfileHome`).
2. `getMe` + best-effort `getActivity`/`getFollowing`/`getSavedOffers`/`getWallet`
   populate the profile card, stats, and wallet (unchanged).
3. Menu rows: My Orders → OrderHistory · Following → FollowedInfluencers · Saved Offers
   → SavedList · My Addresses → Address · **Returns → MyReturns (NEW destination)** ·
   Settings & Help → "Coming soon" alert (unchanged).
4. Wallet card → FollowerWallet. Refer Invite → "coming soon" alert. Logout → confirm →
   clear tokens + navigate FollowerLogin (unchanged).

## Implementation steps
- `FollowerNavigator.js` `ProfileStack`: add `<Stack.Screen name="MyReturns"
  component={MyReturnsScreen} />` (import already present). Verify NO duplicate name in
  ProfileStack (native-stack dup = hard crash).
- `MeScreen.js`: change the Returns menu item `onPress` → `navigation.navigate('MyReturns')`.
- `MeScreen.js`: add the faint 💰 watermark to the wallet card (absolute Text, low opacity,
  `pointerEvents="none"`, `overflow:hidden` already on the card).

## Verify
- `node --check` MeScreen.js + FollowerNavigator.js.
- metro bundle compile (mobile syntax gate via OTA publish).
- `pnpm qa` from repo root → 79 passed / STATE=GREEN / gate 0 (mobile-only → inert to
  web/api/db lanes; classify any flake, never fake-green).
- Manual: Profile → Returns opens the returns list (not order history); wallet shows watermark.
