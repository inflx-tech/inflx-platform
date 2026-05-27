# Flow 34 — Influencer-mobile Earnings + CommissionDetail + TransactionFeed · Spec

**Bucket**: mobile-influencer redesign (Wave 2)
**Flow position**: 7/23
**Owner**: founder
**Locked**: 2026-05-27

---

## 1 · Problem

Three money screens still on legacy navy/teal/orange palette + DM Sans/Syne fonts:

- `EarningsScreen` (287 LOC) — withdraw hub with TDS preview
- `CommissionDetailScreen` (310 LOC) — per-campaign earnings detail w/ tranche timeline + commission list
- `TransactionFeedScreen` (166 LOC) — follower-transaction commission feed

Off-brand vs Flow 28-33: navy hero (not ink+yellow), teal/orange progress + tranche colors (not success/yellow), navy method-active (not ink+yellow), orange Withdraw CTA (not ink+yellow Outfit-Black UPPERCASE), navyPale TDS card (not yellowPale), navyPale 30-day-window banner (not infoPale), StatusBadge (not StatusPill canonical), 📱/🏦/📄 action emoji in CTAs/icons.

## 2 · Goal

Visual + UX restyle of 3 screens to brandPalette + Outfit/Plus Jakarta Sans/JetBrains Mono fonts + StatusPill canonical migration. Preserve every render branch, every API call, every state machine, every money computation (TDS 10% client-side preview). Zero backend change. Zero StatusPill canonical-map additions (all 5 statuses already covered: processing/completed/failed/released/locked + commission confirmed/pending). Zero new SDK boundaries.

## 3 · Scope

### In-scope

- `Packages/Mobile/src/screens/influencer/EarningsScreen.js` (287 LOC) — full rewrite
- `Packages/Mobile/src/screens/influencer/CommissionDetailScreen.js` (310 LOC) — full rewrite
- `Packages/Mobile/src/screens/influencer/TransactionFeedScreen.js` (166 LOC) — full rewrite

### Out-of-scope

- `backend/**` — zero backend change
- StatusPill canonical map — unchanged (43 entries)
- StatusBadge component — kept for any non-redesigned consumers (this flow migrates to StatusPill)
- Native build / android/* — no native rebuild
- All previously shipped influencer screens (Flows 28-33)

## 4 · Data / dependencies

### 4.1 · API calls preserved verbatim (7 endpoints; 6 GET + 1 POST + 1 URL builder)

| API | Source screen | Use |
|---|---|---|
| `getEarnings()` | Earnings | Wallet/pending/TDS-FY/total-earned |
| `getCampaignEarnings()` | Earnings | Per-campaign earnings breakdown |
| `getWithdrawals()` | Earnings | Withdrawal history list |
| `withdraw({amount_requested, method})` POST | Earnings | Submit withdrawal request |
| `getTdsCertificateUrl(fy?)` | Earnings | URL builder (opens via Linking) |
| `getCampaignCommissionDetail(ciId)` | CommissionDetail | Tranches + commissions + summary |
| `getMyTransactions(page)` | TransactionFeed | Follower-transaction commission feed |

All exist in `Packages/Mobile/src/services/api.js` lines 236, 259, 260, 261, 262, 264, 293.

### 4.2 · DB columns referenced (read-only + 1 INSERT via withdraw)

- `influencers.wallet_balance / pending_balance / total_earned`
- `influencer_withdrawals.status` ∈ {processing, completed, failed} · `amount_requested / tds_deducted / net_paid / method / created_at`
- `escrow_entries.status` ∈ {released, locked} · `tranche_number / amount / released_at / created_at`
- `follower_transactions.status` ∈ {pending, confirmed} · `transaction_type / commission_amount / net_amount / days_until_confirmed / created_at`
- TDS 10% rule (rupees post-021 migration; computed client-side: `tds = amount * 0.1`, `net = amount - tds`)
- Min ₹100 withdrawal validation
- 30-day confirmation window for follower commissions

### 4.3 · No new tables / migrations

## 5 · Risk surface

- **LOW risk** — read-mostly + 1 POST (withdraw) with simple payload
- **TDS 10% math** preserved exactly — `amount * 0.1` for tds, `amount - tds` for net
- **Min ₹100 validation** + Alert preserved
- **Method state machine** ('upi' | 'bank') preserved
- **Show-more toggle** for commission lists > 5 preserved
- **Goal-aware commission section visibility** (conversion + hybrid) preserved
- **FlatList** in TransactionFeed preserved (perf)
- **useFocusEffect reload** preserved
- **Linking.openURL** for TDS certificate preserved
- **fmtMoney / fmtRupees / Math.round** preserved verbatim

## 6 · Success criteria

1. 3 screens render on brandPalette + Outfit/PJS/Mono
2. ALL 16 render branches preserved
3. ALL 7 APIs preserved verbatim
4. StatusBadge → StatusPill canonical migration on 2 screens (Earnings withdrawal history + CommissionDetail tranche status)
5. TDS 10% client-side preview unchanged
6. Min ₹100 validation + Alert unchanged
7. Method selector state machine unchanged
8. TransactionFeed type emojis (🏪📅📦🔗) PRESERVED per design call #4
9. 📄/📱/🏦 action emojis DROPPED (MCI file-document, cellphone, bank)
10. Web `pnpm qa` 76/76 GREEN gate 0 first-run
11. OTA brand v84 / influencer v73 / follower v47 published
12. lock.json `release.released = true` after deploy
13. `06-diff/notes.md` non-empty (gov-check Rule 4)
