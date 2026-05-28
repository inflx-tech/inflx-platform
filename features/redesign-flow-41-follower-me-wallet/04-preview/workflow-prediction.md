# Flow 41 (F2) — Workflow prediction

Per-flow mockup at `04-preview/mockups/web.html` (founder-signed-off). Tiles → source:

## MeScreen
| Element | Source |
|---|---|
| Avatar initials | `getInitials(profile.name)` |
| Name / phone / city | `getMe()` → follower.{name, phone, user_city} |
| Menu rows | static (5 nav routes) |

## FollowerWalletScreen
| Element | Source |
|---|---|
| Available balance | `getWallet()` → wallet.available |
| Pending / lifetime | wallet.pending / wallet.lifetime |
| Tx rows | `getWalletTransactions()` → transactions[] (brand_name, influencer_handle, amount, kind, created_at) |
| Cashback vs redeem | `r.kind === 'redeem'` → negative |
| Creator chip | `t.influencer_handle` via CreatorChip |

## Zero phantom
Every tile traces to a real follower/wallet field. Wallet gracefully shows zeros
when the backend `/follower/wallet` returns nothing (preserved). Accent/icons are
design tokens.
