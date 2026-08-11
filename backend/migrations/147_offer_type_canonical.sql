-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 147 — canonical offer vocabulary on campaign_influencers
-- Contract: features/collab-part1-corrections (§1.4)
--
-- campaign_influencers.offer_type is an unconstrained varchar(30) and three
-- writers disagreed on what goes in it:
--
--   web wizard          'Discount' | 'Volume discount' | 'BOGO' | 'Bundle' | 'Free gift'
--   mobile brand invite 'flat' | 'percentage'
--   library snapshot    'discount' | 'volume' | 'bogo' | 'bundle' | 'free_gift'
--
-- so a collaboration created on web and one created on mobile were not
-- comparable, filterable or reportable together. The library spelling wins: it
-- is already CHECK-constrained on brand_offers and is what gets snapshotted
-- into this column when a saved offer is attached.
--
-- 'flat' and 'percentage' both collapse to 'discount' — they were never separate
-- mechanics. The flat-vs-percent distinction lives in offer_config_json.sub_type,
-- which is what the web wizard has always written, so no information is lost.
--
-- Deliberately NOT adding a CHECK constraint. 'prebook' exists in the legacy
-- campaign enum and is an availing MODE rather than an offer mechanic; no live
-- writer puts it here, but if any historical row carries it, a constraint would
-- make this migration fail rather than convert what it can. The application
-- rejects non-canonical values at write time (offerConfig.validator) and
-- normalises them on read, which covers the same ground without risking
-- historical rows.
--
-- Idempotent: re-running converts nothing because canonical values are not in
-- the legacy map.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- Web wizard display labels → canonical
UPDATE campaign_influencers SET offer_type = 'discount'
  WHERE lower(trim(offer_type)) = 'discount' AND offer_type <> 'discount';
UPDATE campaign_influencers SET offer_type = 'volume'
  WHERE lower(trim(offer_type)) IN ('volume discount', 'volume') AND offer_type <> 'volume';
UPDATE campaign_influencers SET offer_type = 'bogo'
  WHERE lower(trim(offer_type)) = 'bogo' AND offer_type <> 'bogo';
UPDATE campaign_influencers SET offer_type = 'bundle'
  WHERE lower(trim(offer_type)) = 'bundle' AND offer_type <> 'bundle';
UPDATE campaign_influencers SET offer_type = 'free_gift'
  WHERE lower(trim(offer_type)) IN ('free gift', 'free_gift') AND offer_type <> 'free_gift';

-- Mobile brand-invite spellings → canonical. Both are discounts; the sub_type
-- in offer_config_json carries which kind. Backfill sub_type where the mobile
-- app never wrote one, so the read path can still tell flat from percentage.
UPDATE campaign_influencers
   SET offer_config_json =
         COALESCE(offer_config_json, '{}'::jsonb) ||
         jsonb_build_object(
           'sub_type',
           CASE WHEN lower(trim(offer_type)) = 'percentage' THEN 'pct' ELSE 'flat' END
         )
 WHERE lower(trim(offer_type)) IN ('flat', 'percentage')
   AND (offer_config_json IS NULL OR offer_config_json->>'sub_type' IS NULL);

UPDATE campaign_influencers SET offer_type = 'discount'
 WHERE lower(trim(offer_type)) IN ('flat', 'percentage');

COMMIT;

-- Post-migration check (informational — run manually):
--   SELECT offer_type, count(*) FROM campaign_influencers
--    WHERE offer_type IS NOT NULL GROUP BY 1 ORDER BY 2 DESC;
-- Anything outside discount|volume|bogo|bundle|free_gift is a legacy value the
-- map did not cover; the read-side normaliser still resolves it.
