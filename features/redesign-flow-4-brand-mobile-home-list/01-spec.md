# Spec — Redesign Flow 4 · Brand mobile (Home + Campaign list)

## Why this flow

Mobile parity with the brand-web Flow 2 (dashboard chrome + home) and
Flow 3 (campaign list). Catches up the two most-used brand-mobile
surfaces to the locked wave2 design system in one OTA cycle.

## Scope — in

**Mobile (2 files restyled)**
- `Packages/Mobile/src/screens/brand/BrandHomeScreen.js` — full visual restyle: ink header with Logo placeholder · yellow-pale wallet card with corner accent + ink Top-up button (yellow text) · Action Required white card with yellow left-stripe · Quick Actions 2-column grid with yellow icon-circle pattern · campaigns top-5 with locked-palette status badges · status banners (pending/rejected/suspended) restyled.
- `Packages/Mobile/src/screens/brand/BrandCampaignListScreen.js` — full visual restyle: ink header · search with yellow focus halo · ink-active filter chips with mono per-chip counts · sort chips · ink bulk action bar with yellow Cancel + red Delete + ghost Clear · simplified list cards (drop phantom influencer-count rendering).

**No new files. No shared component changes. Logo component (Flow 1) reused as `<Logo tone="light" size="sm" />` on both screens' headers.**

## Scope — out (no-touch)

- `backend/**` (Window A territory)
- `Packages/shared/api/**` and `Packages/Mobile/src/services/api.js`
- All API call shapes (`brandApi.getMe`, `getCampaigns`, `getInboxSummary`, `cancelCampaign`, `deleteCampaign`)
- AsyncStorage keys (`inflx_token`, `inflx_refresh_token`, `inflx_user`)
- All `navigation.navigate(...)` route names + params
- `openWebDashboard` deeplink helper
- Quick Actions: dropped "View My Store" tile (7 → 6) — least-used; brand store browsable from web
- Status filter chip set: keep existing compact 5 ('all', 'active', 'draft', 'pending_wallet', 'completed') rather than expand to 7 — fits horizontal scroll row on mobile
- BrandCampaignDetailScreen.js — separate Flow 5
- All other Mobile screens
- Web (no changes; Vercel/Render get no-op push)

## Tile audit — every visible element traces to a real backend field

| Visible element | Source |
|---|---|
| Home · brand name in header | `brand.business_name` from `brandApi.getMe()` |
| Home · status banner | `brand.user_status` / `brand.status` (pending/rejected/suspended) |
| Home · wallet balance | `brand.wallet_balance` |
| Home · active campaigns count | `campaigns.filter(active\|live).length` |
| Home · total campaigns count | `campaigns.length` |
| Home · Action Required total | `sum(inbox.pending_applications + pending_negotiations + pending_reviews + pending_signatures + contracts_failed + pdf_failed)` from `brandApi.getInboxSummary()` |
| Home · pending-wallet alert | `campaigns.filter(s=pending_wallet).length` |
| Home · top-5 campaign cards | `c.name`, `c.status`, `c.total_budget` from campaigns array |
| List · header count | `campaigns.length` + `.filter(...).length` |
| List · chip counts | `campaigns.filter(s=chip).length` per status |
| List · per-card name | `c.name` (campaigns col) |
| List · per-card status badge | `c.status` (campaigns col) |
| List · per-card start_date | `c.start_date` (campaigns col) |
| List · per-card budget | `c.total_budget` (campaigns col) |
| ~~List · per-card influencer count~~ | ~~`c.sets[*].influencers.length`~~ | **DROPPED** — `GET /campaigns` SELECT * never returns nested `sets`; field reads always 0; guarded behind `> 0` so visible-only-when-nonzero (never appears). Dead-code cleanup. |

## Design system this flow exercises

- Inherits Flow 1 + Flow 2 + Flow 3 locked palette
- New mobile-specific patterns:
  - **Yellow-pale gradient hero card** (wallet) with corner accent + ink content + ink-with-yellow-text Top-up button (a deliberate inversion of yellow-primary CTA for the hero card)
  - **Yellow icon-in-circle Quick Action tiles** — 6 tiles, 2 columns
  - **Ink bulk action bar** for mobile list selection (mirror of web Flow 3 bulk pattern)
  - **Horizontal scroll chip rows** for mobile filter (mirror of web Flow 3 but native scroll instead of wrap)

## User-perceptible changes

1. Header: navy-deep solid → ink black chrome with Logo placeholder + brand name on right
2. Wallet card: navy gradient → yellow-pale soft gradient with corner-glow accent + ink balance + ink Top-up button (yellow text)
3. Status banner copy softened: "Account not approved" → "Your account needs a fix"
4. Action Required: replaces ⚠️ emoji with yellow-pale icon-circle + ink `!` glyph
5. Wallet top-up alert: orange tint → yellow-pale tint with ink content
6. Quick Actions: emoji icons → yellow circles with ink glyph + 7 tiles → 6 tiles (dropped "View My Store")
7. Campaign list cards: dropped `👥 N influencers` row (was always hidden — phantom data per backend audit)
8. Filter chips: navy active → ink active with mono per-chip counts
9. Bulk action bar: white-with-navy-border → ink chrome with yellow Cancel + red Delete + ghost Clear
10. Status badge labels: "Needs Funding" matches existing copy; locked-palette mappings replace navy/orange/teal/red
