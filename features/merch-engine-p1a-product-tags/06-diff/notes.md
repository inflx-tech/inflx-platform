# Before / After — Product Tags (Phase 1a)

> UI-governed diff notes. Screenshot capture (Playwright before/after) must run
> in the dev env with brand-web built — recorded here in plain English meanwhile.

## Admin — Tag Vocabulary (NEW screen)
- **Before:** no such screen; admins had no way to manage tags.
- **After:** `/admin/tag-vocabulary` — scope chips (★ All businesses + per-business + "＋ business"), an add-tag box per scope, and a table of tags with **Edit** (label / sort order / status) and **Hide/Show**. Navy admin theme, matching Master Dishes / App Sections. Mockup reference: `04-preview/mockups/admin-tag-vocabulary.html` (the mockup was gold/cream for layout; the shipped screen uses the admin navy theme so it isn't a visual island).

## Brand — product tag-picker (CHANGED: Add/Edit product modal)
- **Before:** the Add/Edit product modal showed schema fields + an Active toggle. No tags.
- **After:** a **Tags (optional)** block sits below the fields — fixed-tag chips loaded from `GET /brands/me/tag-options` (gold/ink `.chip` style; selected = filled), a free-tag input ("Add your own tag…") that adds dashed removable chips, and an empty-state line when a business has no preset tags. Selected slugs persist on `form.tags` and are sent to `POST/PATCH /brands/me/products`. Mockup reference: `04-preview/mockups/brand-listing-tag-step.html`.
- **Coverage:** standard `ProductFormModal` flow only this slice; ListingWizard + drilldown tree wizard are a follow-up.

## What still needs capturing in dev env
- Playwright shots of the admin screen (empty → tags added → hidden) and the product modal (chips + free tag + summary).
- `pnpm qa:web` green for the admin route + brand products route.
