# Flow 41 (F2) — Expected outputs

## MeScreen
| Element | Expected |
|---|---|
| bg | light P.bg |
| profile card | white + yellow avatar tile + ink initials |
| name | Outfit-Black ink |
| phone/city | mono muted |
| menu icons | yellowPale tiles + MCI (wallet/package-variant/map-marker-outline/account-group-outline/bookmark-outline) |
| menu labels | Outfit-Bold ink + mono uppercase sub |
| logout | danger-border + dangerText Outfit-Black |
| loading | yellow ActivityIndicator |

## FollowerWalletScreen
| Element | Expected |
|---|---|
| balance card | ink bg + yellow label + white mono ₹ + pending/lifetime |
| section title | Outfit-Black "Recent activity" |
| tx (cashback) | successPale gift icon + Outfit-Bold title + CreatorChip + mono date + successText "+₹" |
| tx (redeem) | bg2 arrow-up icon + muted "−₹" |
| empty | dashed tile + 💰 + ink/yellow "Browse partners" |
| how-it-works | bg2 card + yellow numbered steps |

## Data assertions
- ZERO behavior change. getMe / getWallet / getWalletTransactions unchanged
  (graceful zero-fallback preserved).
- logout multiRemove + setRole preserved.
- CreatorChip + negative/pending/lifetime logic preserved.

## Visual evidence (governance — after-screenshots)
- before = `04-preview/mockups/web.html` (this flow's mockup)
- after = Maestro follower OTP-login capture of Me + Wallet → `06-diff/`
  (fallback: founder physical APK smoke-test, documented)
