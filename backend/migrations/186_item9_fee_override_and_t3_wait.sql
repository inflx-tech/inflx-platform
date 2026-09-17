-- 186_item9_fee_override_and_t3_wait.sql
-- Item 9 — two founder decisions, 17 September 2026.
-- Contract: features/item7-agreement (money) · Docs/ITEM9_FUNDING_LOCKING_GAP_REPORT.md
--
-- Additive and behaviour-preserving on the day it runs. Nothing is recalculated,
-- no signed collaboration changes, no money moves.
--
--   A. The per-brand campaign fee becomes a REAL override.
--   B. The Pay for Content final-payment wait defaults to 7 days, not 30.

BEGIN;

-- ---------------------------------------------------------------------------
-- A. The per-brand campaign fee override.
--
--    Founder: "if admin wants per brand settings he can set … default one is 8%
--    we fix … that per brand overrides default one if set in admin."
--
--    It did not override anything. `brands.platform_fee_pct` was read by the old
--    website door and IGNORED by the door that actually locks the money, which
--    always used the platform-wide campaign fee. Every brand happens to sit at
--    8.00 — the column's default, not anybody's decision — so the two agreed and
--    nothing had ever gone wrong.
--
--    For "override" to mean anything, there has to be a way to say "no override".
--    That is NULL. The column is already nullable; it just defaulted to 8.00, so
--    every brand looked overridden.
--
--    Setting the existing rows to NULL changes NO behaviour: 8.00 is exactly what
--    the platform setting says, so every brand keeps the fee it has today. What
--    changes is that a later change to the platform-wide fee will now reach them,
--    which is what a default is for.
-- ---------------------------------------------------------------------------
ALTER TABLE brands ALTER COLUMN platform_fee_pct DROP DEFAULT;

UPDATE brands SET platform_fee_pct = NULL
 WHERE platform_fee_pct IS NOT NULL
   AND platform_fee_pct = (SELECT value FROM platform_settings WHERE key = 'campaign_fee_pct');

COMMENT ON COLUMN brands.platform_fee_pct IS
  'Item 9: the campaign fee for THIS brand, overriding platform_settings.campaign_fee_pct. NULL means follow the platform-wide number, which is the normal case. Set by an admin per brand. Like every other admin number it is STAMPED onto each agreement when that agreement is generated, so changing it never moves a collaboration already signed.';

-- ---------------------------------------------------------------------------
-- B. The Pay for Content final payment waits 7 days, not 30.
--
--    Founder: "pay for content set it default to 7 days … after 7 days of content
--    went for live then we release remaining 50% … also let admin decide if he
--    wants he can set number of days … but make it default 7 days."
--
--    The clock starts when the brand confirms the content is live and is already
--    admin-controlled; only the number changes. Safe to apply today: production
--    holds four tranche-3 rows and all four are still `locked`, so no clock has
--    started and nothing is brought forward by this.
-- ---------------------------------------------------------------------------
ALTER TABLE payment_config ALTER COLUMN tranche_3_release_after_days SET DEFAULT 7;

UPDATE payment_config SET tranche_3_release_after_days = 7, updated_at = now() WHERE id = 1;

COMMENT ON COLUMN payment_config.tranche_3_release_after_days IS
  'Item 9: days after the brand confirms the content is live before the final 50% is released, for Pay for Content and Hybrid. Default 7. Admin-editable on Settings > Payments. This is NOT the sales-commission return window (return_window_days), which counts from each sale.';

COMMIT;
