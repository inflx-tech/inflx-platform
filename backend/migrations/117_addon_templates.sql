-- 117 — Reusable customisation templates (per restaurant).
--
-- A brand-scoped library of saved add-on / variation GROUPS that an owner can
-- re-apply to any dish (copy-on-apply — applying drops a fresh product group,
-- independent thereafter). Stores the group definition as jsonb (name +
-- selection rules + items) so it round-trips straight into the Customise modal.
--
-- Additive + idempotent.

CREATE TABLE IF NOT EXISTS brand_addon_templates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id     uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name         text NOT NULL,                 -- the saved group's name, e.g. "Pizza Toppings"
  is_variation boolean NOT NULL DEFAULT false, -- true = a variation (single, sets price)
  definition   jsonb NOT NULL,                -- { selection_type, is_required, min_select, max_select, items:[{name,price,is_default}] }
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- One template per name per brand (re-saving the same name updates it).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_addon_template_brand_name
  ON brand_addon_templates (brand_id, lower(name));
