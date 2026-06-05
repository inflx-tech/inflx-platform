# Feature Spec — Vertical fan-out (jewellery, footwear, flowers+gifting, pet)

> Order: 6 of 6 · Depends on: #2 (and #1/#4 for pet food) · Status: STUB (draft, not locked). Mostly data — MAY SPLIT into per-vertical contracts at lock.

## Problem / goal
Roll out the remaining discussed verticals on the existing engines. Each is mostly **tree + facet data** on engine #2, except pet-shop which is **dual-mode**. Role: **brand** (sellers).

## Scope
- In scope (one sub-vertical each, likely split at lock):
  - **Imitation jewellery** ([[project_listing_jewellery]] discussion): drill-down, **fixed price** (NOT real gold), ornament-type axis, India-rich material/work facets (kundan/polki/meenakari/oxidised/AD/one-gram), mostly free-size, set-aware. WhatsApp-showcase heavy.
  - **Footwear**: fashion twin; Gender→type tree; **size = dominant variant** (UK/EU/cm, per-size stock); material/occasion facets.
  - **Flowers + Gifting** (one family): **occasion+recipient axis**; new listing attributes — **made-to-order, delivery slot/same-day, perishable, personalization, combo composition**; CTA = Order+Deliver.
  - **Pet shop (dual-mode)**: branded food/meds = **dictionary** (reuse #1/#4 barcode pattern); accessories = **drill-down** (pet-type × type × size); **live pets = enquire-only** (breed/age/vaccination) + regulatory caution — IN/OUT decision at lock.
- Explicitly out of scope: real-gold jewellery (deferred separate vertical); engine code (#2/#4).

## Surfaces touched
- App(s): backend (per-vertical tree/facet seeds + any new listing-attribute types: delivery_slot, personalization, perishable); brand-web (template registration per vertical).
- Roles involved: brand approved; admin authoring.

## Data / contracts
- New/changed: seed `category_nodes`/`facet_definitions` per sub-vertical; extend shared listing-attribute library (delivery_slot, personalization, perishable) used by flowers/gifting; pet food reuses `master_products`/flywheel.
- Endpoints: reuse #2 (+#4 catalog for pet food).
- Money/units: rupees; flowers/gifting price by size (stem count) + add-ons.

## Non-functional
- Auth/role gates: brand approved.
- Failure modes: live-pet listings gated/regulatory-flagged (or excluded); perishable + delivery-slot validation; pet dual-mode routes by product category not just business type.
