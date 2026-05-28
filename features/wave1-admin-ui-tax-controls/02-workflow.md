# Workflow — wave1-admin-ui-tax-controls

## Actors
- Admin (any admin) — viewing values.
- Admin (finance / superadmin) — editing.

## Preconditions
- Wave 1 commit 1 + commit 2a on prod (15253de + 34b1b6e).
- This commit shipped + Vercel/Render redeployed.

## Workflow A — admin sets platform GSTIN + business identity

1. Admin opens `/admin/settings/payments`.
2. Clicks **Edit Config**.
3. Scrolls to the **Tax & Identity** section.
4. Fills in: platform GSTIN, business name, address, state code,
   invoice prefixes.
5. Clicks **Save Changes**.
6. `paymentConfig.service.updateConfig` writes all fields; cache
   busted; subsequent invoice generation (Wave 4) will use these.

## Workflow B — admin enables TCS

1. Same page, edit mode.
2. Toggles **TCS Active** ON.
3. Picks an active-from date (e.g. `2026-07-01`).
4. Save.
5. Wave 3 commerce settlement will check `tcs_active` + `tcs_active_from_date`
   before applying TCS. Until then, the toggle has no runtime effect.

## Workflow C — admin changes T3 release time

1. Same page, edit mode.
2. Adjusts **T3 Release Time (IST)** to e.g. `02:30`.
3. Save.
4. Hourly T3 cron now releases tranches at the first cron tick at
   or after 02:30 IST on the day-N boundary.

## Workflow D — admin sets a per-brand L3 commerce commission override

1. Admin opens `/admin/brands/[id]`.
2. Scrolls to **L3 Commerce Commission Override** card (between
   Platform Fee and Feature Overrides).
3. Types a value (e.g. 3.5).
4. Clicks **Save Override**.
5. PATCH `/admin/brands/:id/commerce-commission-override` writes
   `commerce_commission_override_pct = 3.50`.
6. `pricing.service.computeL3OnFollowerTxn` (Wave 1 commit 1) now
   returns 3.5% for that brand's commerce purchases instead of the
   category × path rate.
7. Admin can click **Clear** to revert.

## Workflow E — admin marks an influencer TDS-exempt

1. Admin opens `/admin/influencers/[id]`.
2. Scrolls to **TDS Controls** card.
3. Ticks **TDS exempt** checkbox.
4. PATCH `/admin/influencers/:id/tax-controls` writes
   `tds_exempt = true`.
5. `withdrawal.service.initiateWithdrawal` (Wave 1 commit 1) now
   skips TDS deduction for that influencer's future withdrawals.

## Workflow F — admin sets a per-influencer TDS override

1. Same TDS Controls card.
2. Leaves exempt unchecked.
3. Types an override % (e.g. 5.0).
4. Clicks **Save Override**.
5. `tds_override_pct = 5.00` written.
6. Future withdrawals deduct 5% instead of the global rate.

## Success
- pnpm qa 76/76 GREEN.
- Admin can manage every Wave 1 field without DB access.
- All 4 Wave 1 admin pages (`pricing/categories`, `settings/payments`,
  `brands/[id]`, `influencers/[id]`) expose the fields they should.

## Failure modes
- Validation: numeric inputs gated client-side; backend re-validates.
- 401/403 on the 2 new endpoints if caller isn't finance+/superadmin.
- 404 if brand/influencer ID doesn't exist.
