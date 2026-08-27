-- 161_production_event_items.sql
-- Contract: features/stage-4-the-shoot (slice 1)
-- Board: 04-preview/mockups/stage4-screens.html panels ④ and ⑤ · ledger #115–#118
--
-- THE GAP
-- production_events carries shipment_courier, shipment_awb and four timestamps. Searched the
-- whole schema and backend/src before writing this: a shipment knows it was SENT and when it
-- LANDED, and has no idea what is inside it.
--
-- So a brand types "3 sarees" into a note, she confirms a sentence, and later tags a product
-- in a post — and nothing can reconcile the three. Items are PICKED from the catalogue here
-- precisely so the box, her receipt and her post are the same objects.
--
-- WHY A TABLE AND NOT JSON ON THE EVENT
-- She answers per item and the brand resends per item, so each item has its own small
-- history. In a JSON blob "she flagged the Indigo saree" is a string-edit; here it is a row
-- with a verdict, a timestamp and a note.
--
-- A RESEND IS A SECOND PARCEL, NOT AN EDIT
-- Hence `parcel_no`. The replacement gets its own courier, its own AWB and its own delivery,
-- and the original rows keep saying what went wrong. Overwriting them would erase the fact
-- that anything did.
--
-- DAMAGED IS RECORDED AND TREATED EXACTLY LIKE MISSING
-- Founder, 2026-08-27. Missing and damaged are different problems, but the platform has no
-- rule about who bears a damaged item — so it is recorded honestly and handled the same way:
-- she shoots what she can, the brand resends or drops it. No liability rule is invented here.
--
-- Additive only. No column dropped, no constraint that could reject a historical row, and
-- nothing to backfill — no shipment that exists today has contents to describe.

BEGIN;

CREATE TABLE IF NOT EXISTS production_event_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_event_id uuid NOT NULL REFERENCES production_events(id) ON DELETE CASCADE,

  -- Picked, never typed. ON DELETE RESTRICT deliberately: a product that is in a parcel
  -- somebody is holding cannot be deleted out from under the record of it being sent.
  product_id          uuid NOT NULL REFERENCES brand_products(id) ON DELETE RESTRICT,

  -- Name and price AS SENT. A product renamed or repriced later must not rewrite what was in
  -- a box in August — the same reasoning the handshake uses for agreed terms.
  name_at_dispatch    text,
  price_at_dispatch   numeric(10,2),
  sku_at_dispatch     text,

  quantity            integer NOT NULL DEFAULT 1 CHECK (quantity > 0),

  -- Which parcel on this shoot. 1 is the original; a resend is 2, and so on.
  parcel_no           integer NOT NULL DEFAULT 1 CHECK (parcel_no > 0),

  -- Her verdict. NULL = she has not answered yet, which is different from "not received".
  --   received | missing | damaged
  -- No CHECK constraint on the value: the application validates it, and a constraint here
  -- would block a future verdict landing additively. Same choice as alloc_scope (148).
  receipt_status      text,
  receipt_note        text,
  answered_at         timestamptz,

  -- Set when the brand answers a shortfall by dropping the item rather than resending.
  dropped_at          timestamptz,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pei_event
  ON production_event_items (production_event_id, parcel_no, created_at);

-- The same product may legitimately appear twice on one shoot — once in the original parcel
-- and once in a resend — so uniqueness is per parcel, not per shoot.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pei_event_parcel_product
  ON production_event_items (production_event_id, parcel_no, product_id);

COMMENT ON TABLE production_event_items IS
  'What is actually in a parcel. One row per product per parcel. Items are picked from the catalogue, never typed, so the box, her receipt and the products she can tag in a post are the same objects. A resend is a new parcel_no, never an edit — the original rows keep saying what went wrong. See features/stage-4-the-shoot.';
COMMENT ON COLUMN production_event_items.receipt_status IS
  'What she said about this item: received | missing | damaged. NULL means she has not answered yet, which is NOT the same as not received. Damaged is recorded and handled exactly like missing (founder 2026-08-27) — she shoots what she can, the brand resends or drops it. No liability rule is implied.';
COMMENT ON COLUMN production_event_items.parcel_no IS
  'Which parcel on this shoot. 1 is the original; a replacement sent after a shortfall is 2. Each parcel carries its own courier and AWB on the event.';
COMMENT ON COLUMN production_event_items.name_at_dispatch IS
  'The name, price and SKU AS SENT. A product renamed or repriced later must not rewrite what was in a box in August.';

COMMIT;

-- Post-migration checks (informational):
--   SELECT count(*) FROM production_event_items;                 -- expect 0
--   SELECT count(*) FROM production_events;                      -- unchanged
