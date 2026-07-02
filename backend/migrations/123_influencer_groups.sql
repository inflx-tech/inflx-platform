-- Migration 123 — Server-persisted influencer groups (F-5).
--
-- Contract: features/influencer-groups/ (brand-scoped saved groups of
-- influencers, replacing the previous browser-localStorage-only groups in the
-- campaign wizard). A brand creates named groups in the Influencers tab and can
-- assign a whole group to a campaign set at once.
--
-- Two additive tables + one index. Fully idempotent (CREATE ... IF NOT EXISTS)
-- and additive — no existing row is altered. Safe to re-run.
--
--   influencer_groups         — the group registry, one row per named group,
--                               scoped to a brand (cascade-deleted with brand).
--   influencer_group_members  — membership join (group ↔ influencer); a member
--                               row is cascade-deleted if either the group or the
--                               influencer is deleted.

CREATE TABLE IF NOT EXISTS influencer_groups (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id    uuid        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name        varchar(120) NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS influencer_group_members (
  group_id      uuid        NOT NULL REFERENCES influencer_groups(id) ON DELETE CASCADE,
  influencer_id uuid        NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  added_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, influencer_id)
);

CREATE INDEX IF NOT EXISTS idx_influencer_groups_brand ON influencer_groups (brand_id);
