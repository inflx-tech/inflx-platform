# 06-diff · Redesign Flow 4 · Brand mobile

## What shipped

### `BrandHomeScreen.js`
- Ink black app header (replacing navy-deep) with `<Logo tone="light" size="sm" />` placeholder + brand name on right
- Status banner: amber/red bg → yellow-pale (pending) / danger-pale (rejected/suspended) with ink/danger icon-circle + `!` glyph
- **Wallet card** — navy gradient → soft yellow-pale gradient + two overlapping yellow corner-accent circles + ink mono balance + 2 stat columns (`Active campaigns` + `Total campaigns`) with divider + **ink Top-up button with yellow text** (deliberate inversion of system yellow primary, distinctive hero treatment)
- Action Required card: existing white card → white card with yellow left-stripe + yellow-pale icon-circle + mono `N` count pill on the title row
- Wallet alert: orange tint → yellow-pale tint with yellow left-stripe + ink title + yellow-hover CTA
- Open Web Dashboard: navy bg → muted white card
- Quick Actions: 7 emoji tiles → **6 yellow-icon-circle tiles** (dropped "View My Store"). 2-column grid, ink glyph in each yellow circle.
- Campaigns top-5: compact cards with name + status badge (locked palette) + mono budget when > 0
- Empty state: 📣 emoji → muted icon-circle + clean copy

### `BrandCampaignListScreen.js`
- Ink black header + mono count line (`N total · N live · N drafts`)
- Search: white input + yellow focus border (mobile equivalent of the web Flow-3 yellow focus halo)
- Filter chips: 5-chip horizontal scroll row (All / Active / Draft / Needs funding / Completed). Active = ink-black with white text; inactive = surface2 with muted text. **Mono per-chip counts inside each chip.**
- Sort chips: secondary smaller chip row (Newest / Oldest / Budget ↓ / Name A→Z) with ink active state
- Bulk action bar: white-with-navy-border → **ink chrome with yellow Cancel button + danger-red Delete button + ghost Clear**. Visible only when selection > 0.
- Cards: name (Outfit 700) + status badge (locked palette mappings) + start_date + budget. Checkbox restyled (ink fill + white tick on selected).
- **Dropped:** `c.sets[*].influencers.length` reading from card meta. Backend never returns nested sets via `GET /campaigns SELECT *` — was always 0, hidden behind `> 0` guard. Dead code cleanup.
- "Create on web" CTA: same logic, restyled to neutral white card

## Functional preservation — verified post-edit

| Item | Status |
|---|---|
| `brandApi.getMe()` | unchanged |
| `brandApi.getCampaigns()` | unchanged |
| `brandApi.getInboxSummary()` | unchanged |
| `brandApi.cancelCampaign(id)` | unchanged |
| `brandApi.deleteCampaign(id)` | unchanged |
| AsyncStorage keys | unchanged |
| Navigation route names (Wallet, Campaigns, BrandActionRequired, BrandEnquiries, BrandConversions, BrandInfluencerBrowse, Profile/BrandProfile, CampaignDetail) | unchanged |
| `openWebDashboard` deeplink | unchanged |
| `useFocusEffect` lifecycle | unchanged |
| `RefreshControl` pull-to-refresh | unchanged |
| Bulk Alert.alert prompts | unchanged |
| `selected` Set state machine | unchanged |
| Filter + sort logic | unchanged |
| Status banner trigger logic (`brand.user_status` / `brand.status` matching) | unchanged |
| Inbox total derivation + parts joining | unchanged |
| Conditional rendering guards (Action Required > 0, pending_wallet > 0, etc.) | unchanged |

## Backend-source audit

Every visible value on both screens traces to a real backend field/aggregate. Single phantom field dropped (list cards' `influencers` count). Documented in `01-spec.md` table.

## QA gate evidence

`pnpm qa` (2026-05-23, post-Flow-4 implementation):

```
67 passed (1.2m)
[qa-report] STATE=GREEN — all reconciliation checks passed
[run-qa] Done. pwExit=0 reportExit=0 → gate 0
```

- All 67 specs GREEN · gate 0 · STATE=GREEN
- C1 verdict machine clean
- No web spec affected by mobile-only changes
- Report → `qa/reports/2026-05-23T13-25-22-120Z/QA-REPORT.md`

## Honest limitations

- **Quick Actions: 6 tiles, dropped "View My Store"** per spec. If you decide later you want the tile back, it's a 1-block addition to the `QUICK_ACTIONS` array (target: `'BrandStorePreview'`).
- **No new Maestro flow for brand home/list** — only the auth-flavour follower-public-browse + smoke flow exist. Flow 4 release uses `GOVERNANCE_OVERRIDE` for Rule 5 per Flow 1 precedent (substituted evidence: `pnpm qa` green + per-file verify-twice in this file + pure visual restyle).
- **Status filter chip count for `active`** combines `'active'` + `'live'` campaigns (existing behaviour). Web Flow 3 chip row shows them as separate chips. Mobile keeps them combined for compactness; the underlying data is identical.
- **Wallet balance source** — uses `brand.wallet_balance` directly from `brandApi.getMe()` response. Doesn't separately fetch wallet endpoint (less network than web Flow 2 which calls `walletApi.getBalance()`). If the future deepens the wallet block (e.g., adding escrow_locked indicator), an additional fetch would be needed.
- **Logo placeholder still in flight** — once founder uploads the real asset to `Packages/Mobile/src/assets/logo/`, `<Logo />` component's `HAS_ASSET` flag flips and the placeholder dashed box swaps to the real artwork on both screens (and across the rest of Mobile).
- **No tokens.js consolidation** — palette hex inlined. Future token-consolidation contract hoists into `Packages/Mobile/src/theme/tokens.js` once enough flows have shipped to justify the abstraction.
