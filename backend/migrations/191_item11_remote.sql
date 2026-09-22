-- 191_item11_remote.sql
-- Contract: features/item11-remote · Docs/ITEM11_REMOTE_GAP_REPORT.md §8, approval §3.4
--
-- Item 11 — the Remote shoot, and INFLX's own shipping layer. ADDITIVE throughout.
-- NO BACKFILL (approval §3.18): the five signed Kanchi Silks Remote collaborations read
-- "Waiting for her address" on the new screens, and the unsigned sixth stays invisible.
--
-- Seven parts:
--   0. four wallet_tx_type values, added first and USED NOWHERE in this file (the same
--      shape as 075 and 105, so the test harness and run-191 execute the identical path);
--   1. the Remote Shoot Plan — her address, the coverage answer, the report marks, on item 10's
--      production_events;
--   2. Delayed — the CHECK widened. THE CURRENT ONE WOULD REJECT EVERY REMOTE STAGE (finding 3);
--   3. shipments — collaboration-agnostic on purpose, so item 16 can use it for an order;
--   4. shipment_events — the webhook's memory: idempotent, order-tolerant, raw payload always;
--   5. brand_branch_pickups — a provider's pickup id per branch (approval §2.5), so item 11
--      does not wait on Shiprocket unknown 1;
--   6. the lines — variant, Return/Gift, the return leg, the report marks;
--   7. brand_dues and the admin number.
--
-- Plus one repair found while building 2a: production_event_log has no deterministic order.
-- Both rows written inside one transaction share now(), so `ORDER BY created_at` is a coin
-- toss — item10-storevisit's "Mode set to visit" assertion flakes on it today, and item 11
-- writes several log rows per transaction (a booking, a webhook event). A bigserial settles it.

ALTER TYPE wallet_tx_type ADD VALUE IF NOT EXISTS 'courier_charge';


ALTER TYPE wallet_tx_type ADD VALUE IF NOT EXISTS 'courier_lock';


ALTER TYPE wallet_tx_type ADD VALUE IF NOT EXISTS 'courier_lock_release';


ALTER TYPE wallet_tx_type ADD VALUE IF NOT EXISTS 'courier_refund';



-- ─── 1. The Remote Shoot Plan ────────────────────────────────────────────────
-- On item 10's table, because it IS the shoot plan — one row per contract, the stage derived
-- from timestamps exactly as item 10 derives the visit's (rules v1.27 §11.2).
ALTER TABLE production_events
  ADD COLUMN IF NOT EXISTS address_sent_at        timestamptz,
  ADD COLUMN IF NOT EXISTS address_corrected_at   timestamptz,
  ADD COLUMN IF NOT EXISTS ship_to_name           text,
  ADD COLUMN IF NOT EXISTS ship_to_phone          text,
  ADD COLUMN IF NOT EXISTS ship_to_street         text,
  ADD COLUMN IF NOT EXISTS ship_to_pincode        text,
  ADD COLUMN IF NOT EXISTS ship_to_state_id       smallint REFERENCES ref_states(id),
  ADD COLUMN IF NOT EXISTS ship_to_city_id        integer  REFERENCES ref_cities(id),
  ADD COLUMN IF NOT EXISTS ship_to_state_name     text,
  ADD COLUMN IF NOT EXISTS ship_to_city_name      text,
  ADD COLUMN IF NOT EXISTS ship_to_note           text,
  ADD COLUMN IF NOT EXISTS ship_to_sizes          text,
  ADD COLUMN IF NOT EXISTS coverage_delivers      boolean,
  ADD COLUMN IF NOT EXISTS coverage_return_pickup boolean,
  ADD COLUMN IF NOT EXISTS coverage_checked_at    timestamptz,
  ADD COLUMN IF NOT EXISTS difference_reported_at timestamptz,
  ADD COLUMN IF NOT EXISTS difference_reported_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS difference_acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS return_reported_at     timestamptz,
  ADD COLUMN IF NOT EXISTS overdue_reported_at    timestamptz,
  ADD COLUMN IF NOT EXISTS remote_reminder_sent_at timestamptz;

ALTER TABLE production_events DROP CONSTRAINT IF EXISTS pe_ship_to_note_len;
ALTER TABLE production_events ADD CONSTRAINT pe_ship_to_note_len
  CHECK (ship_to_note IS NULL OR char_length(ship_to_note) <= 200) NOT VALID;
ALTER TABLE production_events DROP CONSTRAINT IF EXISTS pe_ship_to_sizes_len;
ALTER TABLE production_events ADD CONSTRAINT pe_ship_to_sizes_len
  CHECK (ship_to_sizes IS NULL OR char_length(ship_to_sizes) <= 100) NOT VALID;

COMMENT ON COLUMN production_events.address_sent_at IS
  'Item 11. When SHE sent her delivery address — and the moment it stops being private to her and reaches the owning brand (rules v1.27 §11.2). NULL = the brand sees "waiting for her address" and can do nothing. The address is a SNAPSHOT: her profile changing later changes nothing here (§28).';
COMMENT ON COLUMN production_events.address_corrected_at IS
  'Item 11. Her ONE correction, allowed only after the courier brought the parcel back to the store. A second attempt, or one at any other time, is refused.';
COMMENT ON COLUMN production_events.coverage_return_pickup IS
  'Item 11. Whether the courier network will COLLECT a return from her pincode, as answered when she sent the address. false = the brand is warned before marking any line Return, no return lock is taken, no pickup is booked, and she sends it back herself and marks it (v1.27 §11.2, approval Q1).';
COMMENT ON COLUMN production_events.difference_acknowledged_at IS
  'Item 11 (approval §2.8). The brand pressed "It''s fine, carry on" on R10. It dismisses the box across devices and does nothing else. It is NOT a report.';

-- ─── 2. Delayed — the CHECK widened (finding 3) ──────────────────────────────
-- ci_delayed_stage_known listed five visit/content values. collab-delayed.job would have
-- thrown on the first Remote collaboration it tried to flag.
ALTER TABLE campaign_influencers DROP CONSTRAINT IF EXISTS ci_delayed_stage_known;
ALTER TABLE campaign_influencers ADD CONSTRAINT ci_delayed_stage_known
  CHECK (delayed_stage IS NULL OR delayed_stage IN
    ('plan_not_sent', 'time_not_agreed', 'not_attended', 'not_confirmed', 'content_not_live',
     'address_not_sent', 'not_booked', 'in_transit', 'not_checked', 'shoot_not_marked'));

-- ─── 3. Shipments ────────────────────────────────────────────────────────────
-- KNOWS NOTHING ABOUT COLLABORATIONS. production_event_id is nullable so item 16 can hang a
-- customer order off the same table and the same layer (gap report §12).
--
-- ON DELETE RESTRICT, not CASCADE (approval §2.1): a shipment carries money. Wallet rows name
-- it, brand_dues.source_id points at it, and the aggregator reconciliation needs every one.
-- Deleting a production event must not silently remove a financial record.
CREATE TABLE IF NOT EXISTS shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_event_id uuid REFERENCES production_events(id) ON DELETE RESTRICT,

  direction text NOT NULL CHECK (direction IN ('outbound', 'return')),
  -- 'none' is the no-courier return of approval Q1: she sends it back herself, INFLX books
  -- nothing and moves no money, and the row exists only to carry the confirmation clock.
  provider  text NOT NULL CHECK (provider IN ('simulator', 'shiprocket', 'none')),

  branch_id uuid REFERENCES brand_branches(id) ON DELETE SET NULL,

  -- Both ends, SNAPSHOTTED. A branch edited or a profile changed later never rewrites what was
  -- on a label. The creator never receives from_street / from_pincode (the projection in
  -- production.controller and F1 both withhold them); the return label carries them.
  from_name text, from_phone text, from_street text, from_pincode text,
  from_city_name text, from_state_name text,
  to_name text, to_phone text, to_street text, to_pincode text,
  to_city_name text, to_state_name text,

  box_preset text CHECK (box_preset IS NULL OR box_preset IN ('small', 'medium', 'large', 'other')),
  box_l_cm numeric(6,1), box_w_cm numeric(6,1), box_h_cm numeric(6,1),
  weight_kg numeric(6,3) CHECK (weight_kg IS NULL OR weight_kg > 0),
  declared_value numeric(10,2),          -- approval Q6: SUM(price_at_dispatch × quantity)

  quoted_amount  numeric(10,2),          -- what the provider said
  charged_amount numeric(10,2),          -- what the brand was actually charged
  gst_amount     numeric(10,2),          -- approval Q7: inside the total, never on top
  return_hold_amount   numeric(10,2),    -- locked at the OUTBOUND booking, held for the return
  return_hold_released numeric(10,2),

  courier_name text, tracking_number text, provider_ref text,
  label_key text,
  challan_key text,                      -- approval Q6: nullable, so a delivery challan can be
                                         -- added later without a migration. Item 11 writes none.

  pickup_day date,                       -- the day she chose for the return pickup
  self_sent_at   timestamptz,            -- approval Q1: "I've sent it back", no courier involved
  self_sent_note text,

  booked_at timestamptz, cancelled_at timestamptz,
  collected_at timestamptz, out_for_delivery_at timestamptz,
  delivered_at timestamptz, returned_to_store_at timestamptz,
  last_attempt_failed_at timestamptz, last_attempt_reason text,
  attempt_failed_count int NOT NULL DEFAULT 0,

  rebooked_from_id uuid REFERENCES shipments(id) ON DELETE RESTRICT,

  -- The brand's confirmation of a RETURN, and the clock that confirms it for them.
  autoconfirm_days int, autoconfirm_due_at timestamptz, autoconfirmed_at timestamptz,
  confirmed_at timestamptz, confirmed_by uuid REFERENCES users(id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE shipments DROP CONSTRAINT IF EXISTS shipments_self_note_len;
ALTER TABLE shipments ADD CONSTRAINT shipments_self_note_len
  CHECK (self_sent_note IS NULL OR char_length(self_sent_note) <= 200) NOT VALID;

-- ONE LIVE outbound parcel per collaboration (rules §11.2, §32). "Live" excludes a cancelled
-- one — cancel and book again before collection may be repeated (v1.27, approval Q5) — and
-- excludes one the courier brought back, because that is exactly when a rebook is allowed.
-- The "book again ONCE" limit is the rebooked_from_id chain, enforced in code.
CREATE UNIQUE INDEX IF NOT EXISTS uq_shipments_one_live_outbound
  ON shipments (production_event_id)
  WHERE direction = 'outbound' AND production_event_id IS NOT NULL
    AND cancelled_at IS NULL AND returned_to_store_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_shipments_one_live_return
  ON shipments (production_event_id)
  WHERE direction = 'return' AND production_event_id IS NOT NULL AND cancelled_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_shipments_event ON shipments (production_event_id, direction);

-- The webhook's lookup: a provider hands us a tracking number and nothing else.
CREATE UNIQUE INDEX IF NOT EXISTS uq_shipments_provider_tracking
  ON shipments (provider, tracking_number) WHERE tracking_number IS NOT NULL;

-- J1's lane, as a predicate the index can answer on its own.
CREATE INDEX IF NOT EXISTS idx_shipments_autoconfirm_due
  ON shipments (autoconfirm_due_at)
  WHERE direction = 'return' AND autoconfirm_due_at IS NOT NULL
    AND autoconfirmed_at IS NULL AND confirmed_at IS NULL;

COMMENT ON TABLE shipments IS
  'Item 11. One parcel. Deliberately knows NOTHING about collaborations: production_event_id is nullable so item 16 can hang a customer order off the same table and the same shipping layer. provider is written once at creation and never updated — a simulated shipment can never reach a real courier, and a real one never the simulator.';
COMMENT ON COLUMN shipments.provider IS
  'simulator | shiprocket | none. Written ONCE at creation, never updated. ''none'' is the no-courier return of approval Q1, where couriers will not collect from her pincode: she sends it back herself at the brand''s cost, settled outside INFLX, and marks it sent — which is what starts the brand''s confirmation clock.';
COMMENT ON COLUMN shipments.return_hold_amount IS
  'Item 11. The return price LOCKED from the brand''s available balance at the OUTBOUND booking, so the return can always be paid for (rules §11.2). When the provider gives no return quote it is the outbound price for the same box and weight (v1.27, approval §2.3). Settled at the return pickup: the actual price comes out, the rest goes back. If the actual costs MORE, the difference is charged or recorded as owed — her pickup is never refused or delayed (v1.27, approval §2.2).';
COMMENT ON COLUMN shipments.rebooked_from_id IS
  'Item 11. Set on the second outbound parcel after the courier brought the first back to the store. At most one hop: booking again is allowed ONCE (rules §11.2). The same lines go — the list stays locked — and the return lock from the first booking is kept, not taken twice (approval §2.4).';

-- ─── 4. Shipment events — the webhook's memory ───────────────────────────────
CREATE TABLE IF NOT EXISTS shipment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES shipments(id) ON DELETE RESTRICT,
  provider text NOT NULL,
  event text NOT NULL,
  provider_event_id text,
  -- provider|tracking|event|occurred_at. The whole idempotency rule, in one column, so the
  -- DATABASE refuses a duplicate rather than the application remembering to.
  dedupe_key text NOT NULL,
  occurred_at timestamptz NOT NULL,
  amount numeric(10,2),                  -- a weight charge
  reason text,                           -- a failed attempt, or the courier's words
  payload jsonb NOT NULL,                -- the RAW body, always, before any parsing
  applied boolean NOT NULL DEFAULT false,-- false = recorded but changed no state (out of order)
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_shipment_events_dedupe ON shipment_events (dedupe_key);
CREATE INDEX IF NOT EXISTS idx_shipment_events_shipment ON shipment_events (shipment_id, occurred_at);

COMMENT ON TABLE shipment_events IS
  'Item 11. Every provider update, raw. IDEMPOTENT by the unique index on dedupe_key — the same update twice is one event. ORDER-TOLERANT because the row is always written but the state is only ever moved forward (COALESCE(col, $ts) under WHERE col IS NULL), so a late "out for delivery" after "delivered" records itself and changes nothing. `applied` says which of the two happened.';

-- ─── 5. Pickup locations per branch (approval §2.5) ──────────────────────────
-- Shiprocket unknown 1 — whether one INFLX account may hold a pickup location per brand branch
-- — cannot be answered until the account exists. This shape works either way: register at the
-- first booking from a branch, and again whenever the branch's address changes.
CREATE TABLE IF NOT EXISTS brand_branch_pickups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES brand_branches(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('simulator', 'shiprocket')),
  provider_pickup_id text NOT NULL,
  address_hash text NOT NULL,            -- sha256 of the four parts + phone, as registered
  registered_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_branch_pickup ON brand_branch_pickups (branch_id, provider);

-- ─── 6. The lines ────────────────────────────────────────────────────────────
ALTER TABLE production_event_items
  ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES product_variants(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS variant_label_at_dispatch text,
  ADD COLUMN IF NOT EXISTS disposition text CHECK (disposition IS NULL OR disposition IN ('return', 'gift')),
  ADD COLUMN IF NOT EXISTS disposition_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS disposition_changed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS shipment_id uuid REFERENCES shipments(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS returned_on_shipment_id uuid REFERENCES shipments(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS return_status text,          -- received | missing | damaged
  ADD COLUMN IF NOT EXISTS return_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS return_auto_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reported_at timestamptz,
  ADD COLUMN IF NOT EXISTS reported_by uuid REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE production_event_items DROP CONSTRAINT IF EXISTS pei_receipt_note_len;
ALTER TABLE production_event_items ADD CONSTRAINT pei_receipt_note_len
  CHECK (receipt_note IS NULL OR char_length(receipt_note) <= 300) NOT VALID;

-- The 161 index is (event, parcel_no, product_id) — which makes the SAME product in two sizes
-- a duplicate. With variants that is a legitimate pair of lines, so a second partial index
-- covers them and the old one keeps governing variant-less lines.
DROP INDEX IF EXISTS uq_pei_event_parcel_product;
CREATE UNIQUE INDEX IF NOT EXISTS uq_pei_event_parcel_product_novariant
  ON production_event_items (production_event_id, parcel_no, product_id)
  WHERE variant_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_pei_event_parcel_product_variant
  ON production_event_items (production_event_id, parcel_no, product_id, variant_id)
  WHERE variant_id IS NOT NULL;

COMMENT ON COLUMN production_event_items.variant_id IS
  'Item 11 (v1.27 §11.2, approval Q2). NULLABLE: a product with active variants must be sent in a chosen one; a product without them is sent as itself. "At most 5" counts per (product, variant), and per product where it has none.';
COMMENT ON COLUMN production_event_items.disposition IS
  'return | gift. Return items come back to the brand after the shoot, at the brand''s cost; gifts stay with her. A Return may become a Gift until the return pickup is booked; a Gift NEVER becomes a Return once the parcel is booked (§28). Every change records who and when.';

-- ─── 7. Dues, the admin number, and the log's order ──────────────────────────
CREATE TABLE IF NOT EXISTS brand_dues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  reason text NOT NULL,                  -- 'weight_charge' | 'return_overspend'
  source_kind text NOT NULL,             -- 'shipment'
  source_id uuid,
  note text,                             -- the courier's own words
  created_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz,
  settled_tx_id uuid REFERENCES wallet_transactions(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_brand_dues_open
  ON brand_dues (brand_id, created_at) WHERE settled_at IS NULL;

COMMENT ON TABLE brand_dues IS
  'Item 11 (v1.27 §11.2, approval Q4). What a brand owes INFLX because a courier charge arrived when its wallet was short. It NEVER BLOCKS ANYTHING, including a new booking. It is taken oldest-first from any money that next reaches brands.wallet_balance — every credit path, not only top-ups — and only as far as that credit reaches, in the same transaction.';

INSERT INTO platform_settings (key, value, min_value, max_value, unit, label)
VALUES ('remote_return_autoconfirm_days', 7, 1, 30, 'days', 'Remote return auto-confirm')
ON CONFLICT (key) DO NOTHING;

-- The log's order. Both rows written in one transaction share now() — `ORDER BY created_at` is
-- a tie, and item10-storevisit's "Mode set to visit" assertion flakes on it today. Item 11
-- writes several log rows per transaction, so this stops being cosmetic.
ALTER TABLE production_event_log ADD COLUMN IF NOT EXISTS seq bigserial;
CREATE INDEX IF NOT EXISTS idx_pel_event_seq ON production_event_log (production_event_id, seq);
COMMENT ON COLUMN production_event_log.seq IS
  'Item 11. A monotonic tiebreaker. created_at DEFAULT now() is the TRANSACTION timestamp, so two rows written together are indistinguishable by it. Readers order by (created_at, seq).';


-- Post-migration checks (informational — scripts/run-191.js --dry prints all of them):
--   SELECT count(*) FROM production_events;                                       -- 12, unchanged
--   SELECT count(*) FROM production_event_items;                                  -- 0, unchanged
--   SELECT count(*) FROM campaign_influencers WHERE delayed_at IS NOT NULL;       -- 0
--   SELECT count(*) FROM shipments;                                               -- 0 (new)
--   SELECT count(*) FROM shipment_events;                                         -- 0 (new)
--   SELECT count(*) FROM brand_branch_pickups;                                    -- 0 (new)
--   SELECT count(*) FROM brand_dues;                                              -- 0 (new)
--   SELECT key, value FROM platform_settings WHERE key = 'remote_return_autoconfirm_days';  -- 7
--   SELECT count(*) FROM unnest(enum_range(NULL::wallet_tx_type));                -- 11
--   SELECT count(*) FROM campaign_influencers
--     WHERE delayed_stage IS NOT NULL AND delayed_stage NOT IN (...);              -- 0
--   SELECT count(*) FROM production_event_log WHERE seq IS NULL;                  -- 0
