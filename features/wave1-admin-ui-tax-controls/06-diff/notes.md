# 06-diff — wave1-admin-ui-tax-controls

**Before:** Wave 1 commit 1 added 12 new fields to `payment_config`
(M072 + M074) + 3 per-actor override columns (M073). The backend
service layer reads from them with defensive `??` defaults — but
**no admin UI exposed any of them for editing**. Wave 1 commit 2a
shipped the `/admin/pricing/categories` editor (gap #6) including
per-category `return_window_days`. The other 4 fields needed admin
surfaces:

| Field | Lives on | Pre-commit-2 surface | Post-commit-2 surface |
|-------|---------|-----------------------|------------------------|
| gst_pct | payment_config | (none) | /admin/settings/payments FIELDS list |
| tcs_pct + tcs_active + tcs_active_from_date | payment_config | (none) | /admin/settings/payments "Tax & Identity" sub-section |
| platform_gstin / business_name / address / state_code | payment_config | (none) | /admin/settings/payments "Tax & Identity" sub-section |
| invoice_prefix_subscription / _commerce | payment_config | (none) | /admin/settings/payments "Tax & Identity" sub-section |
| tranche_3_release_after_days | payment_config | (was hardcoded 30 in cron) | /admin/settings/payments FIELDS list |
| tranche_3_release_time_ist | payment_config | (was hardcoded 06:00 UTC cron) | /admin/settings/payments "Tax & Identity" sub-section |
| brands.commerce_commission_override_pct | brands | (direct SQL only) | /admin/brands/[id] new card |
| influencers.tds_override_pct + tds_exempt | influencers | (direct SQL only) | /admin/influencers/[id] new card |

**After:** all 4 admin pages now have UI for all Wave 1 fields. The
2 new endpoints (`PATCH /admin/brands/:id/commerce-commission-override`
+ `PATCH /admin/influencers/:id/tax-controls`) mirror existing
override endpoints exactly — same auth gate (finance+), same null-
clears-override convention.

### Code shape changes

**`admin.controller.js`** — 2 new handlers + 2 export additions.
Implementation copies `setBrandEscrowFeeOverride` structure
(validation, null-clears, UPDATE + RETURNING).

**`admin.routes.js`** — 2 new PATCH routes.

**`api.js`** — 2 new client helpers (one-liners).

**`/admin/settings/payments`**:
- FIELDS array gains 3 standard numeric entries (gst_pct, tcs_pct,
  tranche_3_release_after_days).
- `cfgToForm` extended with all 12 new camelCase keys.
- New "Tax & Identity" section component below FIELDS:
  - TCS Active toggle + conditional active-from date input.
  - T3 Release Time (IST) input (HH:MM picker).
  - 6 platform identity / invoice prefix text inputs.

**`/admin/brands/[id]`**:
- New state (`commerceInput`, `savingCommerce`).
- New `saveCommerceOverride(clear)` async function (mirror of
  existing `saveFee`).
- New card between "Override Platform Fee" and "Feature Overrides".

**`/admin/influencers/[id]`**:
- New state (`tdsInput`, `savingTds`).
- New `saveTdsControls({exempt, clear})` async function.
- New "TDS Status" Field in the info grid.
- New "TDS Controls" card below the profile card.
- Exempt checkbox + override input + Save/Clear buttons.

### Defensive behaviour

- Exempt toggle wins over override (when exempt is on, override input
  disabled; saved exempt also clears override on next save if admin
  intends to remove exemption).
- All admin endpoints accept null to clear override → reverts to
  global default.
- Frontend defaults match backend defaults (GST 18%, TCS 1% off,
  invoice prefixes 'INF-SUB' / 'INF-COM', T3 03:00 IST).

**Verified locally:** boot smoke clean; pnpm qa 76/76 GREEN (46.0s).
The 3 updated pages render correctly with the new sections.
