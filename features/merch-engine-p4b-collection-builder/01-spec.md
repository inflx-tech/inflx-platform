# Feature Spec — Collection builder + placement (Phase 4b)

> Phase 4 step 2 of 2 (4a engine ✅ → 4b admin builder + placement).
> Makes collections usable end-to-end. UI-governed (brand-web admin). Spec →
> mockup-lock → implement → 06-diff.

## Problem / goal
4a built the collection data + render pipeline (dormant). **Goal (4b):** an admin
**Collection Library** to compose a collection (name + image + **ordered list of sections**)
and a **Collection** placement option (App Sections) so it renders to followers.

Mirrors Phase 3's proven shape (builder like 3b, placement like 3c) — for collections.

## Scope
- **In scope:**
  - **Backend CRUD** `/v1/admin/collection-library` — GET (list), POST (create), PATCH
    (update incl. status). Wires the existing `collectionLibrary.service`. `requireAnyAdminRole`.
  - **Admin UI** `app/admin/collection-library/page.js` (navy) + nav link:
    - list collections (name, member count, hide/show, edit).
    - builder modal: **Name** · optional **Business** (grouping) · **Image URL** · **Sections**
      = add from a dropdown of Section-Library sections → an **ordered list** with ↑/↓/remove.
  - **Placement** in `app/admin/sections/page.js`: new preset **"Collection"** (`rule='collection'`,
    `shelf_type='products'` placeholder, the engine expands it). Row editor: when
    `rule==='collection'`, a **collection picker** dropdown → sets `config_json.collection_id`
    + title (collection name). Publish-guard: a collection placement needs a collection picked.
  - `api.js` adminApi: list/create/update collection-library.
- **Explicitly out of scope:**
  - No backend engine/mobile change (4a already renders collections). No migration.
  - Dedicated collection PAGE (Phase 6). Templates formalization (already satisfied).

## Surfaces touched
- **App(s):** brand-web admin (new page + App Sections preset) + backend (admin routes/controller).
  Reuses `GET /admin/section-library` (3b) for the section picker. No mobile.
- **Roles:** admin.

## Data / contracts
- No migration (4a's `collection_library` exists).
- New `adminCollectionLibrary.controller.js` + routes:
  - `GET /admin/collection-library` → `{ collections: [...] }`
  - `POST /admin/collection-library` `{name,business_type?,image_url?,section_ids[]}` → `{ collection }`
  - `PATCH /admin/collection-library/:id` (partial incl. status) → `{ collection }`
- Placement row stored in `section_config`: `rule='collection'`, `config_json={ collection_id }`,
  `title=<collection name>`. The 4a engine expands it on render.

## Non-functional
- **Auth/role gates:** `requireAnyAdminRole` on all endpoints.
- **Failure modes:** create with empty name → 422; a collection with 0 sections → allowed to
  save (admin may fill later) but renders nothing (4a suppresses empty); placement without a
  collection picked → publish blocked; a member section later hidden → that shelf drops, header
  stays if ≥1 member remains (4a behavior).
- **Theme:** navy admin.
- **Deploy:** brand-web (Vercel) + backend routes (Render). No mobile/OTA. released=false until
  founder verifies the follower render (the Phase-4 payoff).
