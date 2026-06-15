# Feature Spec — Section rule-builder UI (Phase 3b)

> Phase 3 step 2 of 3 (3a engine ✅ → 3b rule-builder UI → 3c placement+render).
> UI-governed (brand-web admin, navy theme). Spec → mockup-lock → implement → 06-diff.

## Problem / goal
3a shipped the data-driven evaluator + `section_library` table, but there's no way to
author sections. **Goal (3b):** an admin **Section Library** screen where the founder
composes reusable sections from filters — no code — with a **live "matches N products"
preview** so a rule's effect is visible before saving.

3b makes sections *authorable*. Placing one on a follower screen so it renders is **3c**.
(A section authored in 3b does nothing follower-visible until placed in 3c.)

## Scope
- **In scope:**
  - **Backend CRUD**: `/v1/admin/section-library` — GET (list, optional `?business_type=`),
    POST (create), PATCH (update), DELETE/PATCH-status (hide). Wires the existing
    `sectionLibrary.service` CRUD. `requireAnyAdminRole`.
  - **Backend preview**: `POST /v1/admin/section-library/preview` `{business_type, rule_json}`
    → `{count, sample[]}` — runs the 3a evaluator at PLATFORM scope (no creator/brand
    context) so the builder shows how many gated products a draft rule catches + a few examples.
  - **Admin UI** `app/admin/section-library/page.js` (navy theme) + nav link:
    - list sections (grouped by business), create/edit modal, hide/show.
    - **rule-builder**: business select (the 5 tiles); **sub-category** tree picker
      (from `GET /listing/tree?vertical=` — shown only for fashion/furniture, which have a
      tree); **tags** multi-select (from `GET /admin/tag-vocabulary?scope=<business>`);
      **price** min/max; **sort** (newest / price ↑ / price ↓); optional image URL.
    - **live preview**: as the rule changes, call the preview endpoint (debounced) → show
      "matches N products" + thumbnail strip of the sample.
- **Explicitly out of scope:**
  - Placement / rendering to followers → **3c**.
  - Sub-category filtering for food/beauty/cars (their products have no `category_node_id`;
    food sub-cat = dish dictionary, a separate later wire-up). For those businesses the
    builder hides the sub-category field and uses category+tags+price+sort. Stated, not silent.
  - Product "trending" sort (Phase 7). Collections/Templates (Phase 4).

## Surfaces touched
- **App(s):** brand-web admin (new page + nav) + backend (new admin routes/controller).
  Reuses existing `/listing/tree` + `/admin/tag-vocabulary`. No mobile.
- **Roles:** admin only (`requireAnyAdminRole`).

## Data / contracts
- No migration (3a's `section_library` already exists).
- New routes (admin): `adminSectionLibrary.controller.js` + wired in `admin.routes.js`:
  - `GET /admin/section-library?business_type=` → `{ sections: [...] }`
  - `POST /admin/section-library` `{business_type,name,image_url,rule_json}` → `{ section }`
  - `PATCH /admin/section-library/:id` (partial) → `{ section }`
  - `POST /admin/section-library/preview` `{business_type,rule_json}` → `{ count, sample }`
- `lib/api.js` adminApi: add the 4 calls.
- Preview runs `sectionRules.runRule('library_products', ctx)` with
  `ctx = { ruleDef: validated rule, categoryCats: taxonomy.membersFor(business_type), limit }`,
  platform scope (no influencer/brandId) → honest gated count.

## Non-functional
- **Auth/role gates:** `requireAnyAdminRole` on every endpoint (founder's account isn't always superadmin).
- **Failure modes:** invalid rule → 422 from service validation; preview on a draft with no
  filters → returns all gated products for that business (count could be large — fine, it's a preview);
  empty match → "0 products — this section would be hidden" hint; tree/tags fetch failure →
  graceful (builder still works with the other fields).
- **Theme:** NAVY admin (text-t1/t2/t3, bg-navy, border-border, surface2) — NOT gold/cream.
- **Deploy:** brand-web (Vercel) + backend (Render). released=false (founder verifies). No mobile/OTA.
