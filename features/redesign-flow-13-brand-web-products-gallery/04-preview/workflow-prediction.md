# Flow 13 · preview workflow-prediction — mockup → backend source mapping

Verifies every visible element in `04-preview/mockups/web.html` traces to a real backend field shipped today (no phantom metrics, no new endpoints).

---

## State 1 — Products · Master Catalogue (car_rental)

| Element | Backend source |
|---|---|
| Count chip `{N} active in fleet` | `catalogue.items.filter(i => i.is_activated).length` |
| Outfit H1 | `schema.icon` + `schema.product_noun_plural` |
| Sub-line | static + `schema.label` |
| INK schema bar — icon + label | `schema.icon`, `schema.label` |
| INK schema bar — availing modes | `schema.availing_modes[]` |
| INK schema bar — booking type | `schema.booking_type` (when `features.booking`) |
| INK schema bar — professional catalogue badge | `schema.features.master_catalogue === true` |
| "My Fleet" section count | `items.filter(i => i.is_activated).length` |
| Activated card image | `item.image_url` |
| Activated card name + price | `item.display_name || item.name` + `item.activated_price` (mono ₹) |
| Activated Live/Hidden pill | `item.is_active` boolean |
| Activated spec line (vehicles) | `item.seats`, `item.fuel_type`, `item.transmission` |
| Activated packages | `item.variants_json` (JSON-parsed) |
| Activated Edit/Remove actions | `setEditPriceItem(item)` opens modal; `onDeactivate(item.product_id)` → `deleteProduct` |
| Segment chips | distinct `item.segment` for vehicles (or `item.category` for salon) |
| Master card image | `item.image_url` |
| Master card topbadge | `item.segment || item.category` |
| Master card spec line | vehicles: `seats`, `fuel_type`, `transmission`; salon: `category`, `duration_mins_default`, `gender` |
| Master card `+ Add to Fleet` | `setActivateItem(item)` opens `ActivateModal` |

## State 2 — Products · Standard view (restaurant)

| Element | Backend source |
|---|---|
| Count chip | `products.filter(p => p.is_active).length` of `products.length` |
| `+ Add Dish` button | `setModal('add')` opens `ProductFormModal` |
| Section chips | `schema.sections[]` |
| Row card avatar veg/non-veg | `product.veg_flag` ('veg' / 'non_veg' / 'na') |
| Row card name | `product.name` |
| Row card section tag | `product.section` |
| Row card Hidden tag | `!product.is_active` |
| Row card description | `product.description` |
| Row card stock | `product.stock > 0` |
| Row card variants chip | `product.variants_json` parsed length > 0 |
| Row card bookable | `product.is_bookable` |
| Row card mono price | `product.price` |
| Row card Live/Hidden pill | `product.is_active` |
| Edit / Hide-Show / Del actions | `setModal(product)` / `handleToggle(product)` / `handleDelete(product)` |

## State 3 — ProductFormModal

| Element | Backend source |
|---|---|
| Modal title `Edit/Add {noun}` | `schema.product_noun` + edit/add mode |
| Modal sub `{icon} {label}` | `schema.icon`, `schema.label` |
| Veg toggle | when `schema.features.veg_flag === true` |
| All other fields | `schema.fields[]` with `field.type`, `field.required`, `field.label`, `field.options` |
| Active toggle | `form.is_active` |
| Save button | `handleSave(form)` → `createProduct` or `updateProduct` |

## State 4 — Gallery · Brand Assets

| Element | Backend source |
|---|---|
| Count chip | `assets.length` |
| Sub-tab counts | `assets.length`, `links.length`, `contracts.length` |
| UsageBar — used / quota | `usage.used_bytes` / `usage.quota_bytes` (computed MB) |
| UsageBar — pct fill | `usage.used_pct` (red if ≥90%) |
| UsageBar — remaining | `usage.remaining_bytes` |
| Tag chips | `TAG_OPTIONS` (constant) + per-tag count from `assets.filter(a => a.tags.includes(tag))` |
| Upload dropzone | static; on `handleFiles` → `uploadFileToGallery(file, { title: file.name })` |
| Asset card image gradient | derived from `asset.file_type` (or `asset.download_url` if image/video) |
| Asset card title | `asset.title` |
| Asset card file size | `asset.file_size_bytes` (formatted) |
| Asset card upload date | `asset.created_at` (relative via Flow 10 fmtRelative — NEW) |
| Asset card tag chips | `asset.tags[]` (NEW: palette-mapped vs OLD's tiny gray badges) |
| Asset card Open | `asset.download_url` |
| Asset card Edit | `setEditingAsset(asset)` opens `EditAssetModal` |
| Asset card Del | `mediaGalleryApi.delete(asset.id)` |

## State 5 — Gallery · Reference Links

| Element | Backend source |
|---|---|
| Row card avatar emoji | derived from `link.url` (auto-detect YouTube/Drive/Figma/Notion/IG/Dropbox) |
| Row card title | `link.title` |
| Row card meta | `link.url` + `link.description` |
| Platform tag | derived from URL pattern |
| Open ↗ | `link.url` |
| Edit | `setEditing(link)` opens `LinkModal` |
| Del | `referenceLinkApi.delete(link.id)` |

## State 6 — Gallery · Contracts

| Element | Backend source |
|---|---|
| Search input | client-side filter on `c.campaign_name || c.influencer_name || c.influencer_handle` |
| Status filter | client-side filter on `c.status` |
| Row card avatar | initials from `c.influencer_name` |
| Row card campaign name | `c.campaign_name` |
| Row card goal tag | `c.campaign_goal` |
| Row card meta `@handle + signed date + deliverable` | `c.influencer_handle` + `c.brand_signed_at` (relative) + (n/a — no deliverable summary field today; could derive from contract terms if surfaced later) |
| Row card mono fee | `c.influencer_fee + c.bonus_amount` |
| Row card status pill | `c.status` |
| View PDF | `c.pdf_url` truthy → opens `ContractPreviewModal` |
| Modal title + sub | `c.campaign_name` + `c.influencer_name` + `c.influencer_handle` |
| Modal Download | `mediaGalleryApi.contractPdfUrl(c.id)` returns `{ url }` |
| Modal iframe | iframe `src={url}` |

---

## Verification at impl time

```
grep -n 'schema\.' Packages/brand-web/app/dashboard/products/page.js
grep -n 'product\.\(name\|section\|price\|description\|veg_flag\|is_active\|is_bookable\|duration_mins\|stock\|variants_json\)' Packages/brand-web/app/dashboard/products/page.js
grep -n 'item\.\(image_url\|segment\|seats\|fuel_type\|transmission\|category\|duration_mins_default\|gender\|is_activated\|activated_price\|product_id\)' Packages/brand-web/app/dashboard/products/page.js
grep -n 'asset\.\(title\|description\|tags\|file_type\|file_size_bytes\|download_url\|created_at\)' Packages/brand-web/app/dashboard/gallery/page.js
grep -n 'link\.\(url\|title\|description\|id\)' Packages/brand-web/app/dashboard/gallery/page.js
grep -n 'c\.\(campaign_name\|campaign_goal\|influencer_name\|influencer_handle\|influencer_fee\|bonus_amount\|status\|brand_signed_at\|pdf_url\)' Packages/brand-web/app/dashboard/gallery/page.js
```

Every match must correspond to a row in the tables above. Any access to a field NOT in the tables = phantom; must be removed before merge.
