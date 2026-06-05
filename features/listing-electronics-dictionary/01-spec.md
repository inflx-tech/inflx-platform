# Feature Spec — Electronics dictionary (model + GTIN + scan)

> Order: 4 of 6 · Depends on: #1 (flywheel) · Status: STUB (draft, not locked). India-only. Net-new vertical-type.

## Problem / goal
Electronics is a **dictionary vertical** (identical SKUs across shops) but has **no master table, no GTIN/barcode, no scan** in prod. Goal: seller **searches a model or scans the box barcode → specs+image auto-fill → sets price/stock/condition**. India-only: anchor on **brand+model number** (public, reliable); the Indian barcode is **learned from real boxes via the flywheel**. Role: **brand** (electronics shop) + **admin** (catalog/queue).

## Scope
- In scope: `master_products` (brand, model, category, specs jsonb, image, popularity_rank); variant→GTIN mapping (many GTINs → one variant); seed pipeline from **Open Icecat** (India-sold models); **model typeahead search** + **barcode lookup** endpoint; reuse flywheel (#1) for unknown models/barcodes; seller flow search/scan→autofill→price+stock+**condition**(New/Open-box/Refurb/2nd-hand)+warranty; MRP-vs-selling price.
- Explicitly out of scope: real-time price feeds, non-India markets, full Icecat paid tier (Open tier only at launch), live POS integration.

## Surfaces touched
- App(s): backend (migrations + catalog/scan service + Icecat seed script); brand-web (model search + scan/condition step); admin-web (catalog + dish-queue-equivalent for electronics).
- Roles involved: brand approved, admin.

## Data / contracts
- New tables: `master_products(id, brand, model, category_key, specs jsonb, image_url, popularity_rank)`; `product_gtins(id, master_product_id, variant_key, gtin)` (many-to-one); reuse `product_variants` for storage/color/RAM. Reuse `pending_*` flywheel pattern from #1 for unknown models.
- Endpoints: `GET /catalog/products/search?q=` (model typeahead); `GET /catalog/by-gtin/:gtin` (scan lookup, miss→external API→cache→else flywheel); `POST /brands/me/products` from a picked master + variant + price/stock/condition.
- Money/units: MRP + selling price (rupees); EMI/exchange flags feed CTA.

## Non-functional
- Auth/role gates: brand approved; catalog write = admin.
- Failure modes: barcode scan miss never blocks (manual "enter once" → flywheel); model-search works Day-1 even before scan coverage; one model → many variants → many GTINs (regional/global codes both resolve).
