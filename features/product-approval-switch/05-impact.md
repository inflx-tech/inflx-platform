# Impact

## Verdict

**Additive and reversible. One switch that ships OFF, four new columns with a safe default, one
gate function in front of four publish paths, two admin endpoints, one queue page.** No reader of
"is this product live" is edited, because `pushed_to_store` stays the single live flag.

## What changes

| Layer | File | Change |
|---|---|---|
| DB | `backend/migrations/211_product_approval_switch.sql` | one `platform_settings` row (value 0); four columns on `brand_products` (`approval_status` default `approved`, `approval_requested_at`, `approval_decided_at`, `approval_decided_by`, `approval_note`); one partial index on pending |
| Backend | `services/platformSettings.service.js` | the key, its label and description |
| Backend | new `services/productApproval.service.js` | `required()`, `gatePublish()`, `listQueue()`, `decide()`, `releaseAll()`, `notifyBrand()` |
| Backend | `controllers/brand.controller.js` | createProduct + master activation insert through the gate; updateProduct's `pushed_to_store` through the gate; `approval` on the response |
| Backend | `controllers/listing.controller.js` | `insertProducts` through the gate (batch add + Excel import); `getMyNodeProducts` / `getListingProduct` return the approval columns |
| Backend | new `controllers/adminProducts.controller.js` + `routes/adminProducts.routes.js` | `GET /admin/products`, `POST /admin/products/:id/approve`, `POST /admin/products/:id/reject` — capability `approvals` |
| Backend | `controllers/negotiations.controller.js` | after the settings save, if the switch went 1 → 0, release every waiting product |
| Backend | `controllers/admin.controller.js` | `pending_products` on `/admin/stats` |
| Admin | `app/admin/settings/platform/page.js` | confirm dialog when this switch turns off |
| Admin | new `app/admin/products/page.js`, `layout.js` nav + badge, `approvals/page.js` tile + card, `lib/api.js` three calls | the queue |
| Brand web | `ListingTemplateLayout.js` `DefaultFleetRow`, `dashboard/products/page.js` `ProductRow`, `builtinStepComponents.js` `done`, `publishDriver.js` | the pills, the finish wording |

## What does NOT change

- Every shopper / creator / offer / discovery read of a product (≈20 sites) — untouched, by design.
- `is_active` (Hide / Show on the standard products page) — orthogonal, untouched.
- Orders, offers, posts, money, the brand mobile app, the creator app, the shopper app. **No OTA.**
- Existing products: `approval_status` defaults to `approved`; nothing is rewritten at migration.

## Risks

| Risk | Severity | Guard |
|---|---|---|
| a publish path missed by the gate, so a product goes live without review while the switch is on | medium | every `INSERT INTO brand_products` in `backend/src` (three) and the one `pushed_to_store` writer go through `gatePublish`; E5/E6/E13 cover each |
| the gate blocks publishing when settings cannot be read | low | `required()` answers **false** on a read failure — the safe side keeps today's behaviour (E23) |
| the admin approves a product whose brand hid it meanwhile (`is_active = false`) | low | approval sets `pushed_to_store` only; a hidden product stays hidden until the brand shows it — same as today |
| switch-off releases products a brand had withdrawn | none | only `pending` rows are released (E20) |
| a creator holding an approved-later product is not told it is on sale | low | `decide()` calls `creatorTerms.afterProductChange(before, after)` like the brand's own Show does (E19) |
| the finish screen says "You're live" while products wait | low | `publishDriver` counts `approval.waiting` on each create response (W7) |

## Production-impacting

Migration 211 + Render + Vercel (brand-web, which is also admin). No OTA. Explicit go required
before push.
