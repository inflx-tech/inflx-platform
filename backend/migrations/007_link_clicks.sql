-- Migration 007: Link click tracking table for influencer share links
-- Supports the tracking URL pattern: /s/:influencer_handle?cid=&sid=&oid=&iid=

CREATE TABLE IF NOT EXISTS link_clicks (
  id                BIGSERIAL PRIMARY KEY,
  influencer_handle VARCHAR(100) NOT NULL,
  campaign_id       UUID,
  set_id            UUID,
  offer_id          UUID,
  influencer_id     UUID,
  ip_address        INET,
  user_agent        TEXT,
  referer           TEXT,
  clicked_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_link_clicks_influencer_handle ON link_clicks (influencer_handle);
CREATE INDEX IF NOT EXISTS idx_link_clicks_campaign_id       ON link_clicks (campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_link_clicks_clicked_at        ON link_clicks (clicked_at DESC);
