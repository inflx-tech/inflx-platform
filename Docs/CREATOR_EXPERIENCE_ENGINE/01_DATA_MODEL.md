# 01 — Data Model (proposed, to lock)

> All shapes below are **proposed**, additive, and idempotent. Migration numbers allocated at build time (current max = 126, so new ones are ≥127). Nothing here is DDL to run yet.
> Reflects Phase-0 recommendations D1–D5 in `00_PROGRAM.md`.

Legend: **NEW** = new table · **EXTEND** = alter existing (confirmed schema) · **REUSE** = untouched.

---

## A. Design system (Phase 1)

### `design_tokens` — NEW
One row per reusable style atom. World-scoped or global.
```
id            uuid pk
kind          text  -- 'mood' | 'palette' | 'typography' | 'background' | 'radius' | 'shadow'
key           text  -- stable slug, e.g. 'urban_dark', 'bold_fashion'
label         text  -- admin-facing, e.g. 'Urban Dark'
world_key     text NULL   -- NULL = global; else follower_categories.key
config_json   jsonb -- kind-specific payload (see 03_TOKEN_CATALOG.md)
status        text DEFAULT 'active'  -- active | hidden
sort_order    int  DEFAULT 0
UNIQUE (kind, key)
```

### `design_presets` — NEW
A named bundle of token references + default slot positions. Admin starts a Theme from one.
```
id            uuid pk
key           text UNIQUE      -- 'urban_fashion'
label         text            -- 'Urban Fashion'
world_key     text NULL
tokens_json   jsonb           -- { mood, palette, typography, background, radius, shadow }
positions_json jsonb          -- preferred slot positions (avatar TL, featured right, cta BL…)
status        text DEFAULT 'active'
```

### `design_layouts` — NEW (Phase 3) — holds the Layout Contract
```
id            uuid pk
key           text UNIQUE      -- 'hero_banner', 'square_tile', 'story_card', 'magazine_card'
label         text
kind          text            -- 'banner' | 'card' | 'frame' | 'structure'
aspect_hint   text            -- '16:9' | '1:1' | '9:16' | '4:5' | 'flex'
contract_json jsonb           -- { required:[slots], optional:[slots], hidden:[slots] } (see 02)
world_key     text NULL
status        text DEFAULT 'active'
```
> Section Style (carousel/grid/story-rail) is an **enum on the template** in v1 (D4), not a table yet.

---

## B. Themes (Phase 2)

### `experience_themes` — NEW (the Theme Library)
```
id                    uuid pk
world_key             text NOT NULL          -- 'fashion'
key                   text                   -- 'street_style'
name                  text NOT NULL          -- 'Street Style'
subtitle              text
icon                  text                   -- emoji or icon key
description           text
purpose               text                   -- lifestyle|travel|occasion|seasonal|budget|trend|category|offer|editorial
audience              text                   -- men|women|unisex|kids
preset_key            text REFERENCES design_presets(key)   -- visual identity
supported_categories  jsonb                  -- [category_node_id, …] (curated; feeds creator picker)
min_products          int DEFAULT 4
max_products          int DEFAULT 20
media_rules_json      jsonb                  -- { featured:'required', video:'optional', orientation:'portrait' }
supported_offer_types text[]                 -- ['discount','bundle','bogo','free_gift'] (theme-aware; see brand_offers)
suggested_product_ids jsonb                  -- optional hints
default_title         text
default_subtitle      text
default_cta           text
applicable_worlds     text[]                 -- future reuse
is_blueprint          boolean DEFAULT false  -- seeded starter (D: blueprints are rows, not a separate table)
blueprint_source_key  text NULL              -- which blueprint this was cloned from
status                text DEFAULT 'draft'   -- draft | published | archived
UNIQUE (world_key, key)
```
> **Blueprints** = seeded rows with `is_blueprint=true`. "Create theme" clones a blueprint, then admin edits the delta.

---

## C. Templates (Phase 5)

### `experience_templates` — NEW
```
id                 uuid pk
world_key          text NOT NULL
key                text
name               text            -- 'Street Style Hero'
template_type      text            -- 'creator' | 'automatic' | 'mixed'
theme_key          text REFERENCES experience_themes(key)   -- NULL for pure automatic
design_layout_key  text REFERENCES design_layouts(key)
section_style      text            -- enum v1: 'carousel'|'grid'|'hero'|'story_rail'|'tabs'|'collage'|'magazine'
placement_json     jsonb           -- screens+scopes: {home:['all','men'], creator_store:true, business:'if_products'}
store_rule         text            -- 'always' | 'if_products' | 'manual'
creator_store_rule text            -- 'always' | 'if_creator_has_experience' | 'hidden'
location_priority  jsonb           -- ['city','state','country','global']
status             text DEFAULT 'draft'
UNIQUE (world_key, key)
```

### `section_config` — EXTEND (confirmed schema; D2)
Add:
```
ALTER TABLE section_config ADD COLUMN template_id uuid NULL REFERENCES experience_templates(id);
```
Plus a new rule-library key `'experience_template'` (code, not schema) that resolves creator experiences matching the template, honoring existing scheduling / location / hide-empty. **No change to existing columns or rules.**

---

## D. Creator experiences (Phase 6) — D1: NEW tables, reuse lookbook pattern

### `creator_experiences` — NEW
```
id                 uuid pk
influencer_id      uuid NOT NULL REFERENCES influencers(id)
template_key       text REFERENCES experience_templates(key)
theme_key          text          -- denormalized for fast filtering
brand_id           uuid NULL REFERENCES brands(id)   -- scope of the collab
featured_asset_id  uuid NULL     -- REFERENCES creator_assets(id)
status             text DEFAULT 'draft'   -- draft | published | archived
source_proposal_id uuid NULL REFERENCES influencer_proposals(id)   -- if born from a scoped proposal (Phase 8)
created_at / updated_at timestamptz
```

### `experience_products` — NEW (mirrors `lookbook_products`)
```
id             uuid pk
experience_id  uuid NOT NULL REFERENCES creator_experiences(id) ON DELETE CASCADE
product_id     uuid NOT NULL REFERENCES brand_products(id)
variant_id     uuid NULL REFERENCES product_variants(id)
display_order  int DEFAULT 0
created_at     timestamptz
```
> `creator_lookbooks` / `lookbook_products` (migration 049) remain **REUSE, untouched**.

---

## E. Asset pipeline (Phase 7) — D3: two-level bank + pack

### `creator_assets` — NEW (creator-level Asset Bank)
```
id                     uuid pk
influencer_id          uuid NOT NULL REFERENCES influencers(id)
campaign_influencer_id uuid NULL REFERENCES campaign_influencers(id)  -- source collab
deliverable_id         uuid NULL REFERENCES deliverables(id)          -- if it came from a deliverable
r2_key                 text NOT NULL
media_type             text            -- image/video mime
aspect                 text            -- 'landscape'|'portrait'|'square'  (auto-detected on upload)
status                 text DEFAULT 'pending'  -- pending | approved | rejected
approved_by            uuid NULL
approved_at            timestamptz NULL
created_at             timestamptz
```

### `creator_product_images` — NEW (links an approved shot to a product)
```
id             uuid pk
influencer_id  uuid NOT NULL
product_id     uuid NOT NULL REFERENCES brand_products(id)
asset_id       uuid NOT NULL REFERENCES creator_assets(id)
status         text DEFAULT 'pending'  -- pending | approved | rejected
approved_at    timestamptz
UNIQUE (influencer_id, product_id, asset_id)
```

### `brand_products` — EXTEND (per-context image choice)
```
ALTER TABLE brand_products
  ADD COLUMN display_image_source_influencer_id uuid NULL REFERENCES influencers(id);
-- NULL = show brand's own image_url (today's behavior, unchanged).
-- set = brand chose this creator's approved shot for its OWN store.
```
> **Rule (code, central `resolveProductImage`):** brand store = brand's choice (own or chosen creator); **creator store = that creator's own approved shot only**; fallback = `brand_products.image_url`. Ships behind a flag; default off = today's single-image behavior.

---

## F. Proposals (Phase 8) — EXTEND `influencer_proposals` (confirmed schema, migration 025)
```
ALTER TABLE influencer_proposals
  ADD COLUMN scope_level        text NULL,   -- 'store' | 'category' | 'product'
  ADD COLUMN scope_ref_json     jsonb NULL,  -- {category_node_id} or {product_ids:[…]}
  ADD COLUMN theme_key          text NULL,   -- proposed experience theme
  ADD COLUMN proposed_product_ids jsonb NULL;
```
On accept, seed a `creator_experiences` draft (status='draft', source_proposal_id set). No change to existing proposal columns / state machine.

---

## G. Signals (Phase 10)

### `product_view_events` — NEW (nothing tracks views today; link_clicks ≠ views)
```
id            uuid pk
product_id    uuid NULL
experience_id uuid NULL
brand_id      uuid NULL
follower_id   uuid NULL
context       text          -- 'home'|'creator_store'|'business'|'experience'
created_at    timestamptz
```
Aggregation job feeds `most_viewed` / trending-product rules (Phase 9/10). Mirrors existing `section_events` (migration 125).

---

## Reused untouched (REUSE)
`brand_products`* , `product_variants`, `brand_offers`, offer engine, `deliverables`, `brand_media_assets`, `influencer_store_inventory`, `creator_lookbooks`/`lookbook_products`, `world_rule_settings`, `follower_pages`, section engine + rules, campaigns/sets/`campaign_influencers`, contracts/escrow.
*(`brand_products` gets one additive nullable column in E; existing behavior unchanged when NULL.)*
