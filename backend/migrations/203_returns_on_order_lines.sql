-- 203 — shopper-walk-fixes (features/shopper-walk-fixes · 01-spec.md W14): the shopper's Return.
--
-- The returns table (migration 048) was written for the older order shape (one product per sale).
-- Orders placed through a creator's post are order_lines; a return now names the ITEM it is for, and
-- items returned together (the rest of a deal, a gift that no longer qualifies) share one request.
--
-- ADDITIVE and idempotent. Nothing existing is changed: no return has ever been asked for.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE follower_returns ADD COLUMN IF NOT EXISTS order_line_id uuid REFERENCES order_lines(id);
ALTER TABLE follower_returns ADD COLUMN IF NOT EXISTS request_id    uuid;
COMMENT ON COLUMN follower_returns.order_line_id IS 'The item (order_lines) this return is for. NULL for a return made under the older order shape.';
COMMENT ON COLUMN follower_returns.request_id    IS 'Items a shopper returns together (a deal''s items, a gift that follows) share one request.';

-- An item that came back is closed like a cancelled one, and says so: cancelled_by = 'return'.
-- A cash-on-delivery return has no payment to send back; INFLX pays it by hand: refund_status = 'manual'.
ALTER TABLE order_lines DROP CONSTRAINT IF EXISTS order_lines_cancelled_by_check;
ALTER TABLE order_lines ADD  CONSTRAINT order_lines_cancelled_by_check
  CHECK (cancelled_by IS NULL OR cancelled_by IN ('shopper', 'brand', 'admin', 'system', 'return'));
ALTER TABLE order_lines DROP CONSTRAINT IF EXISTS order_lines_refund_status_check;
ALTER TABLE order_lines ADD  CONSTRAINT order_lines_refund_status_check
  CHECK (refund_status IS NULL OR refund_status IN ('pending', 'issued', 'failed', 'not_needed', 'manual'));

CREATE INDEX IF NOT EXISTS idx_follower_returns_line    ON follower_returns (order_line_id) WHERE order_line_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_follower_returns_request ON follower_returns (request_id)    WHERE request_id IS NOT NULL;

COMMIT;
