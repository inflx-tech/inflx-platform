# Impact Analysis — Flow 26

> Chat: **Impact: zero functional / backend / DB impact — visual + 1 single-screen rewrite + 1 HTML string color swap inside Razorpay checkout HTML (#1B2D5E → #0A0A0A).**

## Affected files
- **Modified**: `Packages/Mobile/src/screens/brand/BrandWalletScreen.js` — full visual rewrite, behavior preserved 1:1, SDK boundary preserved verbatim. ONE color string change in `buildRazorpayCheckoutHTML`.
- **NOT touched**: theme/tokens.js, StatusPill, ScreenHeader/EmptyState (not consumed — Wallet has bespoke hero + transaction list patterns), react-native-webview / AsyncStorage / Razorpay checkout.js CDN

## APIs — none changed
- getWallet, getWalletTransactions, getMe, createTopup, verifyTopup, updateMe — all consume existing endpoints with identical payload shapes

## Regression surface
- pnpm qa: zero web/backend changes; expect modulo env-flake
- 24 Wave-3 follower screens: untouched (theme/tokens unchanged)
- Razorpay flow: HTML theme color is the only string change; Razorpay accepts any hex; their UI accent updates to match. No semantic / behavior change.
- AsyncStorage session check: preserved verbatim
- nav reset to Auth on UNAUTHORIZED: preserved verbatim

## Migration / deploy
- New migration: No
- Mobile JS: Yes → OTA × 3
- NATIVE_RUNTIME: NOT bumped (no native modules added; react-native-webview already in APK)
- Maestro Rule 5: GOVERNANCE_OVERRIDE on close-out

## Risk
- **HTML string change**: theme color `'#1B2D5E'` → `'#0A0A0A'` inside `buildRazorpayCheckoutHTML`. Single literal substitution in a template string. Razorpay's checkout.js applies `theme.color` to the modal accent (button highlights, focus rings). Hex format unchanged. No semantic risk.
- **WebView message handling**: preserved verbatim — 3-type switch (SUCCESS / FAILED / DISMISSED) + manual close path with onRequestClose. No new message types added.
- **Mock-order branching**: `order_id.startsWith('order_mock_')` → auto-verify path preserved with same pay_mock_${Date.now()} + mock_signature payload.
- **Money rendering**: fmtMoney (paise→rupees /100) used throughout — preserved exactly. Quick chips use fmtRupees(amt) where amt is already rupees (UI shortcut display) — preserved.
- **Session check at load + topup**: preserved verbatim with same Alert + getParent().reset() flow.
- **Bank save**: preserved verbatim with same validation + payload shape.

## Time estimate
- Mockup + lock: 25 min
- Implementation: 75 min
- QA + commit + push + OTA + close-out: 20 min

Total: ~120 min.

## Pattern extraction watch
After this flow, Wallet's bespoke hero card pattern (ink + huge mono digit) is unique vs Profile/Notifications/etc. heroes. Could be extracted as `<BalanceCard amount label subStats />` if Wallet pattern recurs (it won't — only one wallet screen per role). Skip extraction.
