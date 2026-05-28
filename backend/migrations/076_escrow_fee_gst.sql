-- 076_escrow_fee_gst.sql
-- Wave 2 commit 3 — L2 GST on the Protection Fee (escrow fee).
--
-- Adds escrow_entries.fee_gst_amount: the GST on the platform's escrow fee,
-- computed EXCLUSIVE (fee_gst = escrow_fee_amount × payment_config.gst_pct/100)
-- at fee capture (escrow.service.createEscrowEntries) and surfaced to the brand
-- as a separate line so they can claim input credit (decision 2).
--
-- Scope boundary: this RECORDS + DISPLAYS the GST on the escrow fee. It does NOT
-- change net_to_influencer or the brand's funded amount — the actual GST
-- invoice / collection is Wave 4 (compliance reporting). Pre-076 rows keep
-- fee_gst_amount NULL; the brand-facing controllers derive it on read.
--
-- Forward-only, idempotent, additive — safe to apply before the code deploy.

ALTER TABLE escrow_entries ADD COLUMN IF NOT EXISTS fee_gst_amount numeric(10,2);
