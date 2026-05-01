-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 024 — Production Coordination (Phase P)
--
-- Adds the production-event layer that sits between contract activation and
-- deliverable submission. Tracks the physical/logistical handshake — visit
-- shoots, product shipments — that today happens off-platform on WhatsApp.
--
-- Core idea: each contract has at most one production_event, with mode set
-- when the brand approves the contract. Remote mode auto-completes; visit
-- and shipment modes drive a small state machine.
--
-- Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- 1. Mode lives on the contract — chosen at the brand-approve step so the
--    influencer sees it before signing.
ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS production_mode TEXT;
  -- 'visit' | 'shipment' | 'remote' (null until brand approves)

-- 2. The event itself. One row per contract.
CREATE TABLE IF NOT EXISTS production_events (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id                     UUID UNIQUE NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  mode                            TEXT NOT NULL,
  status                          TEXT NOT NULL DEFAULT 'proposed',
  -- proposed | confirmed | in_progress | completed | cancelled

  -- Visit fields
  visit_address                   TEXT,
  visit_pincode                   TEXT,
  visit_city                      TEXT,
  visit_state                     TEXT,
  visit_maps_url                  TEXT,
  visit_scheduled_at              TIMESTAMPTZ,
  visit_window_minutes            INT,
  visit_contact_name              TEXT,
  visit_contact_phone             TEXT,
  visit_completed_at              TIMESTAMPTZ,

  -- Shipment fields
  shipment_to_address_line        TEXT,
  shipment_to_pincode             TEXT,
  shipment_to_city                TEXT,
  shipment_to_state               TEXT,
  shipment_courier                TEXT,
  shipment_awb                    TEXT,
  shipment_dispatched_at          TIMESTAMPTZ,
  shipment_expected_at            TIMESTAMPTZ,
  shipment_delivered_at           TIMESTAMPTZ,
  shipment_received_confirmed_at  TIMESTAMPTZ,
  shipment_notes                  TEXT,

  reschedule_count_brand          INT NOT NULL DEFAULT 0,
  reschedule_count_influencer     INT NOT NULL DEFAULT 0,

  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_production_events_status
  ON production_events(status, mode);

-- 3. Action log — every transition is recorded for audit + UI history strip.
CREATE TABLE IF NOT EXISTS production_event_log (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_event_id      UUID NOT NULL REFERENCES production_events(id) ON DELETE CASCADE,
  actor_user_id            UUID REFERENCES users(id),
  actor_role               TEXT,    -- 'brand' | 'influencer' | 'admin' | 'system'
  action                   TEXT,    -- proposed | accepted | counter_proposed | rescheduled
                                    -- | dispatched | received | completed | cancelled
                                    -- | mode_set
  notes                    TEXT,
  metadata                 JSONB,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_production_event_log_event
  ON production_event_log(production_event_id, created_at DESC);

COMMIT;
