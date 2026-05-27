# Flow 34 — Workflow

**Actor**: Influencer (logged-in, role=`influencer`).

## A · EarningsScreen (withdraw hub)

### Preconditions
- User tapped "Wallet" tab in `InfluencerNavigator` (or deep-link from Home wallet glance strip).

### Steps
1. Mount → `load()` issues `Promise.all([getEarnings(), getWithdrawals(), getCampaignEarnings()])`.
2. Pull-to-refresh re-issues same 3 calls.
3. Renders:
   - Ink hero with yellow rule + uppercase mono "AVAILABLE TO WITHDRAW" label + yellow-mono amount + 3-mini-stat row (Pending / TDS This FY / Total Earned in white-mono)
   - Campaign Earnings section: muted-uppercase title + per-campaign cards (Outfit-Bold name + mono UPPERCASE brand + goal badge purple-conv or yellow-engagement + 3-stat row + success+yellow progress bar + mono UPPERCASE foot meta)
   - Tap campaign card → `navigation.navigate('CommissionDetail', { campaignInfluencerId, campaignName })`
   - Withdraw Funds section: ink-active method picker (UPI/BANK with MCI cellphone/bank icons) + ink-bordered amount input with Outfit-Black ₹ + mono number + yellowPale TDS preview card (3 rows: Requested + TDS -10% danger + You Receive success) + ink/yellow Outfit-Black WITHDRAW NOW CTA
   - Tax Certificate: yellowPale MCI file-document tile + Outfit-Bold "Download TDS Certificate" + mono Form-16A sub + chevron
   - Withdrawal History list (if any): ink-mono net amount + mono UPPERCASE requested+TDS sub + method·date sub + StatusPill canonical (processing/completed/failed)
4. Withdraw flow (`handleWithdraw`):
   - Parse `amount` as rupees
   - Validate `amount >= 100` else `Alert.alert('Minimum ₹100 withdrawal')`
   - Set `withdrawing` true
   - POST `withdraw({ amount_requested: amtRupees, method })`
   - On success: Alert with net_paid + clear amount + reload
   - On error: Alert with error message
5. TDS Certificate tap → `Linking.openURL(getTdsCertificateUrl())` with error Alert fallback

### Failure modes
- API error → silent (load completes; sections show empty states)
- Withdraw API error → Alert
- TDS cert URL fail → Alert

### Success state
Influencer sees current available balance, picks UPI/BANK + amount, sees TDS-10% preview, hits WITHDRAW NOW, receives confirmation Alert.

---

## B · CommissionDetailScreen (per-campaign earnings detail)

### Preconditions
- Tapped a campaign card in `EarningsScreen` → route params `{ campaignInfluencerId, campaignName }`.

### Steps
1. Mount → `load()` issues `getCampaignCommissionDetail(campaignInfluencerId)`.
2. Loading state: ink ActivityIndicator.
3. Error state: "Could not load commission details" + retry button.
4. Renders:
   - Ink hero with BACK + Outfit-Black campaign name + mono UPPERCASE brand + 3-stat hero card (Earned successGreen / Pending warn-orange / Total white) on rgba-white-7 bg
   - Info row: 3 tiles (Goal / Status / Fee) with mono UPPERCASE values
   - Tranche Timeline: per-tranche row with success-fill dot (released) or ink-bordered yellow current (locked) + check-bold MCI icon + tranche-card (white or success-light bg if released) + StatusPill canonical (Released/Locked) + mono UPPERCASE amount + date
   - Follower Commissions section (if goal ∈ {conversion, hybrid} OR commissions.length > 0):
     - Section title with mono % chip
     - 2 summary cards (Confirmed successText / Pending-30d warn-yellowText) with success/yellow left borders
     - Per-commission tx rows with success/yellow dot + white card + Outfit-Bold type + mono amount (success when confirmed) + mono date + UPPERCASE mono "Xd to confirm" warn or "CONFIRMED" success
   - Show all toggle if commissions > 5
   - 30-day confirmation info banner (infoPale + Outfit-Black title + body copy)
5. Pull-to-refresh re-issues same call

### Success state
Influencer sees full breakdown of this campaign's tranche payouts + follower commission accrual.

---

## C · TransactionFeedScreen (follower-tx commission feed)

### Preconditions
- Tapped "Transactions" deep-link from Home wallet glance or campaign detail.

### Steps
1. Mount + tab-focus → `loadData()` issues `getMyTransactions(1)`.
2. Sets `transactions[]` and `summary{}`.
3. Renders:
   - White-bg light topbar with bg2 back-btn (MCI chevron-left) + Outfit-Bold "My Transactions" + mono sub
   - 3-summary card row (success commission / warn count / info today) with bg2 cards
   - FlatList of transactions with per-tx card:
     - 4 type-pill variants (walkin=successPale 🏪 / book=infoPale 📅 / order=convPale 📦 / click=yellowPale 🔗)
     - Outfit-Bold follower name + mono UPPERCASE brand·product + mono UPPERCASE campaign·date
     - successText "+₹XXX" commission + mono UPPERCASE "SALE: ₹X,XXX" sub
     - Optional booking-ref extra row (mono UPPERCASE)
   - Empty state with 📊 emoji (KEPT per design call #4 — decorative)
4. Pull-to-refresh available

### Edge cases preserved verbatim
- `summary` null → summary row hidden
- `transactions.length === 0` → empty state
- `tx.booking_ref` present → extra ref row rendered

### Success state
Influencer sees real-time commission accrual from follower payments.
