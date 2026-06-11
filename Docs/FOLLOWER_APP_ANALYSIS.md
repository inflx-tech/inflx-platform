# Follower App — Business/Listing/CTA/Screens Analysis (W6, 2026-06-11)

> Requested by founder before the follower-app discussion round. Sources:
> backend/public/schemas/*.json (full read), prod DB census
> (scripts/wt-listing-census.js), brand-web listing components,
> design/wave4-creator-vibe + AGREED-VS-BUILT-DIFF.md.

## 1. Business types in JSONs — 35 schemas (37 categories offered at registration)

**Active (phase 1):** restaurant · fashion_walkin · fashion (unified) · salon · car_rental
**coming_soon:** phase 2 (bakery, gym_fitness) · phase 3 (hotel_homestay, travel_packages, coworking_space, bike_rental) · phase 4 (clinic_doctor, dental_clinic, diagnostic_lab, coaching_center, home_services, home_beauty, pest_control, laundry, pet_grooming, photography, wedding_planner, function_hall, florist, interior_design, legal_ca) · phase 5 (electronics, footwear, jewellery, optical, grocery, packaged_food, pet_shop)
**MISSING schema files:** `flowers_gifting`, `hardware` — offered in the registration industry picker but NO schema JSON exists (a brand registering there hits an undefined listing config).

Schemas are served from backend /public/schemas (Express static; change = redeploy, not CDN yet).

## 2. Listing-model maturity vs the agreed plans

| Category | Agreed model | In code today | Prod data | Verdict |
|---|---|---|---|---|
| restaurant | Dictionary + search flywheel + display-vs-canonical | master_dishes (129 seeded) + picker UI live; **search flywheel + custom-name flywheel = contract #1, sits UNDEPLOYED on branch feat/listing-restaurant-search-flywheel** | 4 brands, 54 products | **PARTIAL — branch needs deploy** |
| fashion | Drill-down tree + facets, drill-once-batch-add | **COMPLETE** — taxonomy engine + batch endpoint + full brand-web wizard (products/listing/page.js, 388 lines, contract listing-drilldown-taxonomy-engine: tree drill, typed facets, per-colour variant pics, 13 size systems, auto-SKU) | 234 nodes in prod; founder published through it (taxonomy-linked product confirmed) | **✅ PERFECT per plan** *(corrected 2026-06-11 — initial W6 report wrongly called the UI a stub; founder challenged, verified)* |
| furniture | Reuses fashion engine (Family axis) | **COMPLETE** — same wizard auto-detects furniture vertical | 99 nodes in prod; founder published through it | **✅ PERFECT per plan** *(same correction)* |
| salon | Master catalogue | master_salon_services + full 5-component wizard | 1 brand, 1 product | **PERFECT per plan** |
| car_rental | Master catalogue | master_vehicles + full 6-step wizard | 5 brands, 17 products | **PERFECT per plan** |
| other 30 | (not yet planned) | Generic brand_products form | florist 1 brand/0 products | GENERIC-ONLY |

**Correction note on the "2 of 74 taxonomy-linked" stat:** the other 72 products are restaurant/salon/car-rental items whose models (master catalogue/dictionary) never set category_node_id — the stat reflects model mix, not a drill-down gap. 4 of 5 phase-1 categories are PERFECT per plan; restaurant is one branch-deploy away.

## 3. Call-to-actions per business (schema availing_modes → actions)

Four CTA archetypes across all schemas: **walkin_pay** (Visit & Pay) · **online_order** (Shop/Order Online) · **book_slot** (Book/Pre-book/Enroll — slot, date-range, appointment, membership variants) · **enquiry** (Get Quote / Check Availability).

| Pattern | Categories |
|---|---|
| Walk-in only | fashion_walkin, electronics, footwear, jewellery, optical |
| Walk-in + online | fashion (unified), grocery, packaged_food, pet_shop, furniture (+enquiry) |
| Booking-led | salon, gym (+day-pass), hotel (date-range), clinic, dental, diagnostic (+walk-in), coaching, home_services, home_beauty, pest_control, laundry (+drop&pay), pet_grooming, photography, travel, bike_rental, car_rental (+at-garage +enquiry), coworking (+day-pass +tour) |
| Order + pre-order | bakery, florist |
| Enquiry-first | function_hall, wedding_planner, interior_design (enquiry-ONLY), legal_ca (enquiry-ONLY) |
| Restaurant | book table + walk-in + online order + enquiry (all four) |

Prod offers usage today: online_order 5 · pay_at_store 5 · prebook 4.

**Known break in the chain (P4, queued):** follower BrandStoreScreen ignores schema actions — hardcoded salon copy. The whole §3 design only reaches followers once the business page reads `brand_config.actions`.

## 4. Follower app screens — the plan and where it stands

Locked plan = 9 comprehensive mockups in design/wave4-creator-vibe (home, category, offers, creator-store, creator-category, business, product, orders, orders-profile) + section-engine architecture (admin-controlled shelves; detail screens admin-templated; CTA from availing_modes). Status per AGREED-VS-BUILT-DIFF (+ updates since):

| Screen | Status |
|---|---|
| Home | Structure ✓; only Eat+Shop zones configured (P5); cards generic vs mockup richness |
| Category | Close; sub-category chips empty (needs the drill-down taxonomy — same root as §2!) |
| Offers | Shelves now render (D0-B adapter shipped) but tap → 404 (P1); By-Creator mode unbuilt; blank chips (P6) |
| Creator store / creator category | Partial; collabs rail + ranked picks missing |
| Business page | **Biggest gap** — bespoke per vertical instead of the agreed admin-templated block model; CTA bug P4 lives here |
| Product detail | Close; missing the conditional Customize/variants block |
| Orders inbox | Under-built (no 5-type tabs/tracker/QR) — backend verify-loss fixed (D2), app recovery UI pending (P11) |
| Profile | Under-built (stats row, wallet card, refer&earn missing) |

## The connecting insight

Sections 1–4 share ONE dependency chain: **taxonomy (sub-types) → listing UI (brand side) → schema CTAs (follower business page) → follower screens fill with real data.** With fashion/furniture listing confirmed COMPLETE (correction above), the chain's remaining blockers are: (a) the undeployed restaurant flywheel branch, (b) the P4 schema-CTA business-page fix + P1 offer-tap 404 on the follower side, and (c) wiring the existing taxonomy into the follower sub-category chips (P5/category screens). The brand-side foundation is in better shape than the initial report claimed.
