# Feature Spec — Collections engine (Phase 4a)

> Phase 4 step 1 of 2 (4a engine+data+mobile-header → 4b admin builder + placement).
> Layer 5. UI-governed (mobile renderer) + backend. Spec → mockup-lock → implement → 06-diff.

## Problem / goal
Sections (Phase 3) are single shelves. The founder's Layer 5 = **Collections**: a named,
ordered **group of sections** ("Summer Collection" = Summer Dresses + Summer Footwear + Bags).
No collection concept exists today.

**Goal (4a):** the data + render pipeline for collections —
1. a **`collection_library`** table = {name, image, ordered section ids},
2. the engine **expands** a placed collection into a **titled header + its member section
   shelves** (each rendered with full context stacking, reusing the Phase-3 evaluator), and
3. a small **mobile renderer** addition to draw the collection header band.

4a ships the pipeline (dormant — nothing renders until a collection is built + placed in 4b).

## Decisions (locked 2026-06-15)
- Collection UX = **inline titled group of shelves** (not its own page — that's Phase 6
  banner-gateway). Place a collection on a screen → header band + member section shelves inline.
- Phase 4 = Collections only (templates already exist as per-screen configs; Brand Store → Phase 5).

## Scope
- **In scope:**
  - Migration `104_collection_library.sql`: `collection_library` table (+ index).
  - `collectionLibrary.service.js`: CRUD + validation (members are real section ids) +
    `getForRender(id)` → {name, image_url, section rows in order}.
  - **Engine expansion** (`sectionEngine.buildSections`): a `section_config` row with
    `rule='collection'` + `config_json.collection_id` expands, IN PLACE, into:
    (1) a `collection_header` section (name + image, `items:[]`), then
    (2) each member section rendered exactly like a placed `library_products` section
        (business→category, sub-category/tags/price/sort, + surface context: creator/brand/
        city). Unresolved/empty members are skipped; an unresolved collection → nothing.
  - **Mobile** `SectionRenderer`: new `case 'collection_header'` → a titled band (name +
    optional image), rendered even with empty items (added before the empty-items guard).
- **Explicitly out of scope:**
  - Admin Collection builder + placement preset → **4b**.
  - Dedicated Collection PAGE (tap → page) → Phase 6 (banner-gateway).
  - Templates/slots formalization (already satisfied), Brand Store (Phase 5).

## Surfaces touched
- **App(s):** backend (`backend/src/**`, migration) + mobile (`Packages/Mobile/src` —
  one renderer case). No brand-web in 4a.
- **Roles:** admin builds/places (4b); follower sees the rendered collection.

## Data / contracts
- **Migration `104`** (+ `scripts/run-104.js`): `collection_library
  (id, business_type, name, image_url, section_ids uuid[], status, created_at, updated_at)`.
  `business_type` = optional admin grouping (members carry their own business). index `(status)`.
- `collectionLibrary.service.js`: `listCollections`, `getCollection`, `createCollection`,
  `updateCollection`, `getForRender(id)` (used by the engine; returns ordered member section
  rule defs + the header meta).
- **Engine**: when `row.rule==='collection'`, expand to header + member section objects
  (reusing the 3a resolution per member: `sectionLibrary.getRuleJson` + context). The member
  shelves use `library_products` evaluation; the header is a presentation-only section.
- No API shape change for existing endpoints; collections add to the `{ sections }` payload
  as ordinary section objects (header + members) — so the mobile renders them as normal shelves
  plus the one new header type.

## Non-functional
- **Failure modes:** collection with no/hidden members → header alone is suppressed too (don't
  show an empty titled band — engine emits header only if ≥1 member resolves); unresolved
  collection_id → nothing (safety, like 3c); a member section hidden later → that shelf empty/skipped.
- **Reuse:** member rendering = the exact Phase-3 evaluator + context stacking. No new ranking.
- **Deploy:** backend (Render) + mobile (OTA). Dormant until 4b builds/places a collection.
  Production-impacting → explicit founder go; migrate-first.
