# Flow 13 · brand-web products + gallery — spec

**Slug:** `redesign-flow-13-brand-web-products-gallery`
**Status:** locked (mockup approved 2026-05-24)
**Wave:** wave2 redesign (palette · row-card pattern · backend-first tiles)

---

## What this flow restyles

A **2-route bundle** under `/dashboard/`:

| Route | File | LOC OLD |
|---|---|---:|
| `/dashboard/products` | `page.js` (dispatcher) | 794 |
| `/dashboard/gallery` | `page.js` (dispatcher) | 624 |

**1,418 LOC OLD** → **~1,400 LOC NEW** (~equal — palette restyle, no feature add).

---

## Critical scope clarity — listing engine NOT touched

The `Packages/brand-web/app/dashboard/products/components/` directory (~5,500 LOC) is the **schema-driven listing engine spine** per `project_inflx_overview` — the project's most-critical architecture. It contains:

- `templateRegistry.js` (48 LOC) · `ListingTemplateLayout.js` (621 LOC) · `ListingWizard.js` (110 LOC)
- Per-category drivers: `restaurant/` (476 LOC) · `salon/` (1,268 LOC) · `car_rental/` (761 LOC) · `fashion/` (56 LOC)
- Shared atoms: `DynamicFieldRenderer.js` · `ImageField.js` · `LivePreview.js` · `PhotoUploadStep.js` · `QualityScore.js` · `TeamMemberListEditor.js` · `VariantMatrixEditor.js` · `WeeklyScheduleEditor.js` · `BulkUploadCard.js` · `publishDriver.js` · `GoogleMapsLinkField.js` · `builtinStepComponents.js`

**These are PRESERVED VERBATIM in Flow 13.** The ListingWizard path on `/products` (when `listing_engine_active === true`) passes through unchanged. Restyling the listing engine would be a multi-day governance-grade flow on its own.

---

## Backend audit — every visible field traces

### Products page endpoints (all preserved verbatim)
- `GET /brands/me/schema` → `brandApi.getSchema()` — returns `{ schema }` with `category_key`, `product_noun`, `product_noun_plural`, `icon`, `label`, `sections[]`, `availing_modes[]`, `booking_type`, `fields[]`, `features: { master_catalogue?, booking?, enquiry_only?, veg_flag? }`
- `GET /brands/me/products` → `brandApi.getProducts()` — returns `{ products[] }` with `id`, `name`, `section`, `price`, `description`, `veg_flag`, `is_active`, `is_bookable`, `duration_mins`, `stock`, `variants_json`, `image_url`, `master_vehicle_id`, `master_service_id`
- `POST /brands/me/products` → `brandApi.createProduct(body)`
- `PATCH /brands/me/products/:id` → `brandApi.updateProduct(id, body)`
- `DELETE /brands/me/products/:id` → `brandApi.deleteProduct(id)`
- `GET /brands/me/master-catalogue` → `brandApi.getMasterCatalogue()` — returns `{ category, items[] }` (vehicles or services). `items[].is_activated`, `activated_price`, `product_id`, `is_active`, plus per-category fields (vehicles: `segment`, `seats`, `fuel_type`, `transmission`, `image_url`; services: `category`, `duration_mins_default`, `gender`, `image_url`)
- `GET /brands/me/listing-config` → returns `{ listing_engine_active: boolean }` (feature flag — gates ListingWizard path)
- Window A's `QuotaWallModal` + `useQuotaWall` hook preserved

### Gallery page endpoints (all preserved verbatim)
- `GET /brands/me/media-gallery/assets` (with optional `?tag=`) → `mediaGalleryApi.list()` — returns `{ assets[] }` with `id`, `title`, `description`, `tags[]`, `file_type`, `file_size_bytes`, `download_url`, `created_at`
- `GET /brands/me/media-gallery/usage` → `mediaGalleryApi.getUsage()` — returns `{ used_bytes, quota_bytes, used_pct, remaining_bytes }`
- `PATCH /brands/me/media-gallery/assets/:id` → `mediaGalleryApi.update(id, { title, description, tags })`
- `DELETE /brands/me/media-gallery/assets/:id` → `mediaGalleryApi.delete(id)`
- `GET /brands/me/media-gallery/contracts` → `mediaGalleryApi.listContracts()` — returns `{ contracts[] }` with `id`, `campaign_name`, `campaign_goal`, `influencer_name`, `influencer_handle`, `influencer_fee`, `bonus_amount`, `status`, `brand_signed_at`, `created_at`, `pdf_url`
- `GET /brands/me/media-gallery/contracts/:id/pdf-url` → `mediaGalleryApi.contractPdfUrl(id)` — returns `{ url }` (signed URL for iframe preview)
- `GET /brands/me/reference-links` → `referenceLinkApi.list()` — returns `{ links[] }` with `id`, `url`, `title`, `description`, `created_at`
- `POST /brands/me/reference-links` → `referenceLinkApi.create({ url, title, description? })`
- `PATCH /brands/me/reference-links/:id` → `referenceLinkApi.update(id, body)`
- `DELETE /brands/me/reference-links/:id` → `referenceLinkApi.delete(id)`
- Upload helper: `uploadFileToGallery(file, { title })` — multi-part upload to R2 via backend

## Verified — no phantom fields, no API contract changes

- No new endpoint
- No new query param consumed
- No new request body field
- No new response field referenced (all already in shipped responses)
- No new column accessed
- No schema migration

---

## Scope (in-scope)

### Products page
- INK schema info bar replacing the existing white schema-meta card (yellow accent · mono `availing_modes` · `master_catalogue` badge when active)
- Locked-palette restyle of `MasterCatalogueView` (kept as image grid — visual selection essential):
  - "My Fleet/Services" section header with palette pip + count chip
  - Activated item cards: gradient overlay preserved · mono price · Live/Hidden palette pills (success-pale/bg2)
  - Segment tabs as palette chips (replacing dark-button tabs)
  - Master grid: image cards with palette `topbadge` + Outfit name + `+ Add to Fleet` ink button
- Locked-palette restyle of `Standard` view (switched to compact row cards):
  - Section filter chips palette-styled
  - **ProductCard → compact row cards** (~60-70px tall) with: 36px avatar (veg/non-veg colored dot for restaurant; placeholder square otherwise) · name + section tag + Hidden tag if applicable · description meta line with stock/variants/bookable inline · mono price · Live/Hidden status pill · Edit/Hide/Show/Del actions
- Locked-palette restyle of all 3 modals (ProductFormModal · ActivateModal · EditPriceModal):
  - Outfit H3 · mono section label · palette input focus rings · ink+yellow primary CTAs
  - Veg toggle: success-pale/danger-pale active states
  - Variant builder: palette inputs · ink "+ Add Package"
  - Active toggle: success-colored switch
- Loading skeleton restyled to locked-palette pulse
- Listing engine path (when `useListingWizard === true`) passes through unchanged

### Gallery page
- Header with count chip + Outfit H1 + sub
- INK sub-tab pills (Brand Assets · Reference Links · Contracts) with mono counts
- **INK UsageBar** (replacing white card with thin bar) — yellow mono numbers · yellow fill bar · red fill when ≥90%
- Brand Assets:
  - Tag filter as palette chips with counts
  - Yellow-pale gradient upload dropzone with drag-drop preserved
  - Asset grid (4-col preserved — images need space): palette tag chips · mono file size · relative upload date · palette action buttons
  - EditAssetModal: locked-palette field stack + palette tag picker + ink+yellow Save
- Reference Links:
  - **Switched from list-with-hover-bg to compact row cards**
  - Platform-colored avatar (YouTube/Drive/Figma/Notion/IG/Dropbox auto-detected)
  - Platform tag chip · 1-line meta (URL + description fragment)
  - Primary `Open ↗` ink-yellow button + Edit/Del secondary
  - LinkModal: locked-palette form
- Contracts:
  - **Switched from table to compact row cards** (Flow 9 consistency)
  - Influencer initials avatar · campaign name + goal tag · meta line (@handle + signed date + deliverable summary) · mono fee · status pill (active=success-pale · pending_influencer/pending_brand=yellow-pale · draft=bg2 · cancelled=danger-pale)
  - View PDF action
  - ContractPreviewModal: locked-palette header with mono signed date · ink+yellow Download button · preserved iframe for PDF

### Cross-cutting
- All numbers / handles / dates / IDs / file sizes in JetBrains Mono
- CSS scoping discipline from day 1: products page under `.prd`, gallery page under `.gal`
- Relative date helper (Flow 10 `fmtRelative`) for asset upload times + contract signed dates
- Adjacent-fixes:
  - Gallery's inline `fmtRupees` duplicates lib/api's — use shared one
  - Contract status colors (amber/blue/green Tailwind) → palette mapping
  - Loading skeletons restyle from gray pulse → locked-palette spinner

## Out of scope

- Any backend touch (controllers, routes, migrations, services)
- Any change to API request body / response shape
- Any new endpoint or query param
- `products/components/` directory (listing engine spine) — preserved verbatim
- `gallery/components/GalleryPicker.js` (not used by /gallery page directly; preserved)
- Sidebar / layout changes
- Drag-reorder of products/assets (not in OLD UI; no backend support today)
- Bulk-delete / bulk-edit (not in OLD UI)
