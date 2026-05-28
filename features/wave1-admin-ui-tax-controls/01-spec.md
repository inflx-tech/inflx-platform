# wave1-admin-ui-tax-controls

> Wave 1 final commit — admin UI surfaces for the remaining tax /
> per-actor config that Wave 1 commit 1 laid the backend foundation
> for. After this lands, all Wave 1 fields are admin-controllable
> end-to-end without DB access.

## What ships

### Backend admin endpoints (2 new)

- `PATCH /admin/brands/:id/commerce-commission-override` (finance+)
  - Body: `{ commerce_commission_override_pct: number | null }`
  - null clears the override, brand reverts to category × path defaults.
  - Mirrors `setBrandEscrowFeeOverride` shape exactly.
- `PATCH /admin/influencers/:id/tax-controls` (finance+)
  - Body: `{ tds_override_pct: number | null, tds_exempt: boolean }`
  - Lets admin (a) override the global TDS rate per-influencer, or
    (b) mark exempt entirely (for influencers with a valid exemption
    certificate on file).

### Frontend — `/admin/settings/payments`

- Existing FIELDS array extended with: `gst_pct`, `tcs_pct`,
  `tranche_3_release_after_days` (all standard numeric inputs).
- New "Tax & Identity" sub-section below the numeric fields with
  mixed input types:
  - **TCS Active** toggle (boolean) + **Active from date** input
    when TCS is on.
  - **T3 Release Time (IST)** input (HH:MM picker).
  - **Platform GSTIN** (15 chars).
  - **Platform Business Name** (text).
  - **Platform Business Address** (textarea).
  - **Platform State Code** (2 chars).
  - **Subscription Invoice Prefix** + **Commerce Invoice Prefix**.

### Frontend — `/admin/brands/[id]`

- New "L3 Commerce Commission Override" card between "Override
  Platform Fee" and "Feature Overrides".
- Shows current value (or "using category × path defaults" if null).
- Save Override / Clear buttons.

### Frontend — `/admin/influencers/[id]`

- New "TDS Status" Field in the info grid.
- New "TDS Controls" card below the profile card:
  - Exempt toggle (checkbox).
  - Override % input (0–30) + Save Override / Clear buttons.
- Override input is disabled when exempt is on (since the exemption
  trumps any override).

### Frontend — `lib/api.js`

- New helpers: `setBrandCommerceCommissionOverride(brandId, pct)` +
  `setInfluencerTaxControls(influencerId, tdsOverridePct, tdsExempt)`.

## Verify-twice

- M072 + M073 + M074 already on prod (Wave 1 commit 1 certification
  15253de). All columns the UI writes to are present.
- `paymentConfig.service.updateConfig` allowed-list (Wave 1 commit 1)
  already includes every field the new payments-page section writes
  to. No backend change for those.
- The 2 new per-actor endpoints are direct mirrors of existing
  `setBrandEscrowFeeOverride` shape — same auth gate (finance+),
  same null-clears-override convention.

## Out of scope

- Wave 2 (GST math on Protection Fee, brand wallet withdrawal,
  Available/Reserved/Settled breakdown, mid-cycle upgrade pro-ration).
- Wave 3 (Razorpay Route for commerce settlement, TCS calculation,
  per-category window cron).

## Files

- `backend/src/controllers/admin.controller.js` — 2 new handlers +
  exports.
- `backend/src/routes/admin.routes.js` — 2 new routes.
- `Packages/brand-web/lib/api.js` — 2 new API helpers.
- `Packages/brand-web/app/admin/settings/payments/page.js` — FIELDS
  extension + Tax & Identity section.
- `Packages/brand-web/app/admin/brands/[id]/page.js` — L3 Commerce
  Override card.
- `Packages/brand-web/app/admin/influencers/[id]/page.js` — TDS
  Controls section + Field.
- This contract.

## Non-functional

- Deploy posture: PRODUCTION-IMPACTING (Vercel redeploys brand-web
  with all UI changes; Render redeploys backend with 2 new admin
  endpoints). NO migration (Wave 1 commit 1's M072+M073+M074 already
  live).
- Backward compatible: every new admin write path mirrors an existing
  one or accepts null/false defaults. All new columns have defaults
  matching prior behaviour.
- pnpm qa 76/76 GREEN (no QA spec hits the new sections directly).
