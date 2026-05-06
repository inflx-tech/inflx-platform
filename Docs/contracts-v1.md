# Contracts Specification (v1.3)

> Status: **locked.** Supersedes [contracts-v0.md](contracts-v0.md). Q1 locked: **listing = item, brand = parent.** Four chat refinements + one wizard formalization in v1; three reality-alignment patches in v1.1; URL prefix correction in v1.2; runtime contract + master-catalogue truth + snake_case enumeration in v1.3.
>
> The contract is load-bearing for car_rental (existing) plus restaurant + salon (next). If either of those forces changes back into this doc, that's the signal to revise.

---

## Patch notes (v1 → v1.3)

Reality-alignment patches after backend recon revealed §9 and §6 were misaligned with the live code. Each patch was caught only after a verify-twice pass on the actual files (route mounts, migration history, mobile API client) — the verify-twice rule is now load-bearing for any future claim about backend wiring.

| Version | Patch | What changed |
|---|---|---|
| v1.1 | **Endpoint paths (initial correction)** | Aspirational `/follower/*` paths from v1 replaced with what I believed were the real existing routes. **Note:** v1.1 got the path *suffixes* right (`/prebook`, `/orders`, `/pay-at-store`, etc.) and identified `prebook-daterange` as the only new route — but used the wrong *prefix* `/follower/*`. Corrected in v1.2 below. |
| v1.1 | **lat / lng → latitude / longitude** | Migration 015 already added `latitude DECIMAL(10,8)` and `longitude DECIMAL(11,8)` to `brands`. All references throughout the contract (BrandViewModel, source_fields, sketches) updated to match real column names. |
| v1.1 | **§9 migration touchpoints** | Shrunk from "six endpoints + three column adds + four refactors" to **three real items**: (a) add `brands.phone` + `brands.whatsapp_phone`, (b) add `POST /follower/prebook-daterange` + `bookingService` extension, (c) extract `<ListingTemplateLayout>` from `CarRentalWizard.js`. BrandStoreScreen wiring + brand onboarding UI updates deferred until restaurant schema lands. Master-catalogue dispatch sized after a quick read of the existing endpoint. |
| **v1.2** | **URL prefix `/transactions/*` &rarr; `/follower/*`** | The route file is named `transaction.routes.js` (Phase 4 "transactions" feature) but mounted under `/follower` per [routes/index.js:81](inflx-platform/backend/src/routes/index.js). Mobile clients ([services/api.js:390-403](inflx-platform/Packages/Mobile/src/services/api.js)) confirm the live URLs are `/follower/prebook`, `/follower/orders`, `/follower/pay-at-store`, `/follower/enquiry`, `/follower/slots`. v1.1 had read the file name and assumed the prefix matched. Same root-cause as the lat/lng error: claim made without verifying the mount point. v1.2 corrects every endpoint reference throughout the contract. (Note: the historical `/transactions/*` strings in this row are escaped as `&rarr;` to prevent the in-place global swap from re-corrupting them.) |
| **v1.3** | **Template Runtime Contract added** | New section formalizing the registry-side contract (stepComponents map, FleetRowComponent, customPublish, initialWizardState, NEW canProceed hook). Locks the snake_case &harr; TS interface enumeration table for `step.component` JSON values. Documents `basic_fields` as deprecated with a sunset path. PR-A's `templateRegistry.js` and `builtinStepComponents.js` are the implementation. |
| **v1.3** | **Master-catalogue: no extension needed** | Backend recon found `GET /brands/me/master-catalogue` already dispatches by `brand.category` (car_rental → `master_vehicles`, salon → `master_salon_services`). The `?source=` query parameter speculation in v1.2 §9 is dropped. The implicit dispatch IS the authorization boundary — a salon brand cannot request vehicles, even with a malicious client, because there's no parameter to attack. **Future engineers MUST NOT refactor to explicit `?source=` dispatch; that would reintroduce the gap.** |
| **v1.3** | **Brand-step nav simplification documented** | When auto-skip elides brand steps on repeat-add, the only re-entry path is the "Edit business profile" header link. Deliberate v1 simplification, not an oversight. Inline navigation that bypasses the skip predicate would force every step component to handle a brand-mode toggle. Header link is one affordance, one route, one mental model. |
| **v1.3** | **Repeatable-step header rule** | When brand steps are auto-skipped AND the current step is `repeatable_items`, the renderer prepends a small `for {brand_name}` header so the brand sees context they would otherwise have just walked through. Prevents the "orphaned Add menu item" feel surfaced during PR-A recon. |
| **v1.3** | **Sketch examples normalized to snake_case** | The restaurant + salon JSON sketches in §1 used PascalCase TS interface names (`BrandFieldsStep`, `RepeatableItemStep`, etc.) for `component` values, contradicting the v1.3 enumeration table. Sketches updated to use the canonical snake_case (`brand_fields`, `repeatable_items`). The TS interface names remain as type definitions in §1's TypeScript blocks — they describe the *type*, not the JSON dispatch key. |

---

## Delta from v0

| What | Change |
|---|---|
| **Restaurant model** | Was: restaurant = one listing with menu items as a section. **Now: menu item = listing, restaurant = brand.** Same for salon (service = listing) and wedding (vendor service = listing). Vehicle = listing was already correct. |
| **`brand_config` block** | NEW. Sibling of `card_config`. Holds typed brand-level fields and brand-level actions. Values persist into `brands.listing_data` (column already exists, migration 013). |
| **`attributes_schema`** | NEW on `ListingTemplate`. Typed declaration of every key tag rules / spec_grid / subtitle templates / Excel columns reference. Boot-time validation possible. |
| **Shared `FieldSchema`** | NEW. Single shape used by `attributes_schema`, `brand_config.fields`, the legacy generic `fields[]`, and Excel column definitions. |
| **`cart_scope`** | NEW on `ListingTemplate`. `"brand" \| "listing" \| "global" \| null`. Drives online_order mixing rules. |
| **`available` shape** | Was `boolean`. Now `{ orderable, reason?, resumes_at? }`. Surfaces "Closed until 6pm" / "Out of stock today" instead of hiding. |
| **Action enums split** | `BuyerAction` (transactional, 5 values) flow through `bookingService` and write `follower_transactions`. `BrandContactAction` (contact-only, 4 values) open dialer/maps/share, no commission. |
| **`ContactSection`** | REMOVED from `DetailSection`. Moved into `BrandConfig` as contact actions. |
| **`writes_to` per step** | NEW on `ListingStep`. `"brand" \| "listing"`. Restaurant wizard steps 1, 2, 4 write to brand_config; step 3 creates listing rows. |
| **Booking endpoints** | Locked to real existing routes plus one new route. Today's `/follower/prebook` (polymorphic on `offer_id`) keeps serving table + slot. `POST /follower/prebook-daterange` is added for car_rental's `date_range` shape (today's shoehorn into `notes` retired). All routes share a `bookingService` core that owns attribution writes. |
| **TrackingContext on BrandStoreScreen** | NEW hard requirement. Two entry paths must thread `TrackingContext` through to brand-level transactional CTAs. |
| **`subtitle_template`** | Marked **prescriptive** (was implicitly advisory). Renderer must consume it. |
| **`card_type`** | Locked enum: `"vehicle" \| "menu_item" \| "service" \| "package" \| "product" \| "vendor_portfolio"`. |

---

## Shared types

These types appear across multiple contracts. Single source of truth.

```ts
// ── FieldSchema ─────────────────────────────────────────────────────────────
/**
 * Used by attributes_schema, brand_config.fields, and the legacy generic
 * fields[] array on ListingTemplate. Single shape, single set of validation
 * rules, single binding target for Excel columns.
 */
export interface FieldSchema {
  key: string;
  type: FieldType;
  label: string;
  unit?: string;                   // "₹", "min", "km", "seats"
  required?: boolean;
  options?: string[];              // for type="select" or type="multi_select"
  default?: unknown;
  placeholder?: string;
  /**
   * For type="string[]" — caps the array length. For type="number" — caps the
   * value. For type="string" — caps character length.
   */
  max?: number;
  min?: number;
}

export type FieldType =
  | "string"
  | "number"
  | "boolean"
  | "string[]"
  | "select"
  | "multi_select"
  | "url"
  | "phone"
  | "email"
  | "date"
  | "time"
  | "veg_toggle"          // legacy, still used by restaurant menu items
  | "duration_select"     // legacy, used by salon services
  | "variant_builder"     // legacy, used by car_rental day_rate variants
  | "availability_picker" // legacy, used by car_rental availability_json
  | "team_member_list"    // NEW — salon stylists / clinic doctors
  | "image"               // single uploaded image (R2)
  | "image[]";            // gallery

// ── TrackingContext ─────────────────────────────────────────────────────────
/**
 * Inherited from the share-link query params on initial entry. Threaded
 * through every screen and every action handler so commission attribution
 * survives navigation. NON-NEGOTIABLE — the platform's revenue model
 * depends on this surviving end-to-end.
 */
export interface TrackingContext {
  campaign_id?: string;
  set_id?: string;
  offer_id?: string;
  campaign_influencer_id?: string;
  influencer_id?: string;
}

// ── Actions ─────────────────────────────────────────────────────────────────
/**
 * Transactional. Flow through bookingService → write follower_transactions →
 * earn commission. Locked enum.
 */
export type BuyerAction =
  | "book_slot"        // appointment / table / date-range — handler chosen by BookingType
  | "walkin_pay"
  | "online_order"
  | "enquiry"
  | "external_link";

/**
 * Contact-only. Open dialer / WhatsApp / maps / share sheet. Don't transact,
 * don't earn commission. Locked enum.
 */
export type BrandContactAction =
  | "call"
  | "whatsapp"
  | "directions"
  | "share";

// ── Misc enums ──────────────────────────────────────────────────────────────
export type AvailingMode = "pay_at_store" | "online_order" | "prebook" | "enquiry";
export type BookingType  = "table" | "appointment" | "date_range" | "slot" | "package";
export type CardType     = "vehicle" | "menu_item" | "service" | "package" | "product" | "vendor_portfolio";
```

---

## 1. ListingTemplate Contract

### Interface

```ts
/**
 * A ListingTemplate defines how a brand authors *individual listing items*
 * (menu items, services, vehicles, packages) for a category. Each item
 * becomes one row in `brand_products`. Brand-level fields and brand-level
 * CTAs are NOT here — see BrandConfig.
 */
export interface ListingTemplate {
  // ── Identity ──────────────────────────────────────────────────────────────
  category_key: string;
  label: string;                   // "Restaurant", "Salon", "Car Rental"
  icon: string;                    // emoji
  product_noun: string;            // "Menu Item", "Service", "Vehicle"
  product_noun_plural: string;     // "Menu", "Services", "Fleet"
  super_category: string;          // "eat" | "beauty" | "travel" | ...
  card_type: CardType;
  phase: 1 | 2 | 3 | 4;
  status: "active" | "preview" | "disabled";

  // ── Capability flags ──────────────────────────────────────────────────────
  features: {
    sections: boolean;
    veg_flag: boolean;
    duration_mins: boolean;
    variants: boolean;
    stock: boolean;
    booking: boolean;
    enquiry_only: boolean;
    availability: boolean;
    master_catalogue: boolean;
  };

  // ── Item taxonomy ─────────────────────────────────────────────────────────
  sections: string[];              // "Starters", "Hair Men", "Hatchback"

  // ── Modes the buyer can transact through (per-item) ───────────────────────
  availing_modes: AvailingMode[];
  booking_type?: BookingType;      // listing-level booking type (e.g. car=date_range, salon=appointment)

  // ── NEW: typed declaration of attribute keys ──────────────────────────────
  /**
   * Every key referenced by tag rules, spec_grid fields, subtitle templates,
   * pricing tabs, or Excel columns MUST be declared here. Boot-time
   * validation can verify all references resolve.
   *
   * Example for car_rental:
   *   { seats: { type: "number", label: "Seats" },
   *     fuel_type: { type: "string", label: "Fuel" },
   *     features: { type: "string[]", label: "Features" } }
   */
  attributes_schema: Record<string, FieldSchema>;

  // ── NEW: cart mixing rules for online_order ───────────────────────────────
  /**
   * "brand"   — cart can mix items only from one brand at a time (restaurant)
   * "listing" — cart is for a single listing (rare; e.g. one-vehicle rental package)
   * "global"  — cart can mix items across brands (future: boutique, jewelry)
   * null      — category does not support online_order; cart_scope is N/A
   *
   * BEHAVIOR CONTRACT: when cart_scope: "brand" and the follower attempts to
   * add an item whose brand differs from the current cart's brand, the
   * renderer MUST prompt the user to clear the existing cart before adding.
   * Silent replacement is forbidden. Same rule applies analogously to
   * cart_scope: "listing" (item from a different listing) and is a no-op for
   * "global". Cart-clear prompt copy is renderer-controlled; the rule itself
   * is non-negotiable.
   */
  cart_scope: "brand" | "listing" | "global" | null;

  // ── Wizard definition ─────────────────────────────────────────────────────
  /**
   * Each step declares writes_to (brand vs listing). Restaurant wizard steps
   * for cuisines/hours/photos write to brand_config.fields; the menu step
   * writes brand_products rows. car_rental's wizard is all writes_to: "listing".
   */
  listing_steps: ListingStep[];

  // ── Per-item fields (legacy generic form) ─────────────────────────────────
  /**
   * Used by DynamicFieldRenderer for categories without a custom wizard.
   * Each entry is a FieldSchema. Should be considered LEGACY for any
   * template that ships listing_steps.
   */
  fields: FieldSchema[];

  // ── How wizard state writes to brand_products / brands.listing_data ───────
  product_config: ProductStorageConfig;

  // ── Brand-level configuration (NEW) ───────────────────────────────────────
  brand_config: BrandConfig;       // see Contract 2

  // ── Card / detail rendering hints ─────────────────────────────────────────
  buyer_config: BuyerConfig;
  card_config: CardConfig;         // see Contract 3 (BuyerCard)

  // ── Action types (per-item) ───────────────────────────────────────────────
  /**
   * Per-item availing_modes' configuration. Brand-level actions live in
   * brand_config.actions instead.
   */
  action_types: ActionTypeMap;

  // ── Quality / completeness scoring ────────────────────────────────────────
  quality_rules: QualityRule[];
}

// ── Step definitions ────────────────────────────────────────────────────────

interface BaseStep {
  id: string;
  title: string;
  subtitle?: string;
  component: string;
  /**
   * NEW. Where this step's form data lands.
   *  "brand"   — writes into brands.listing_data via brand_config.fields
   *  "listing" — creates / updates rows in brand_products
   * Default if omitted: "listing" (back-compat with car_rental).
   */
  writes_to?: "brand" | "listing";
}

export type ListingStep =
  | OptionGridStep
  | MasterPickerStep
  | SpecConfirmationStep
  | PricingStep
  | RepeatableItemStep   // restaurant menu, salon service list
  | BrandFieldsStep      // NEW — typed form for brand-level fields (cuisines, hours, team_members)
  | PhotoUploadStep
  | PreviewStep
  | DoneStep;

interface OptionGridStep extends BaseStep {
  options: Array<{ value: string; label: string; sub?: string; icon?: string }>;
}

interface MasterPickerStep extends BaseStep {
  master_source: string;           // "master_vehicles" | "master_services" | "master_dishes"
  filter_by?: string;
  makes?: string[];
}

interface SpecConfirmationStep extends BaseStep {
  auto_fill_from: string;
  spec_fields: string[];
  variant_selector?: boolean;
}

interface PricingStep extends BaseStep {
  price_fields: PriceField[];
  service_toggles_source?: string;
  default_services?: string[];
  photo_slots?: string[];
}

interface PriceField {
  key: string;
  label: string;
  unit: string;
  required: boolean;
  default?: number;
  benchmark_source?: string;
  benchmark_fields?: [string, string];
}

interface RepeatableItemStep extends BaseStep {
  /**
   * Form rendered repeatedly for N items. Each submission becomes a row in
   * brand_products. Used by restaurant menu, salon services.
   * writes_to defaults to "listing".
   */
  item_fields: FieldSchema[];
  min_items?: number;
  max_items?: number;
  group_by_section?: boolean;      // restaurant: group items under sections
}

interface BrandFieldsStep extends BaseStep {
  /**
   * Typed form for brand-level fields. References brand_config.fields keys.
   * writes_to MUST be "brand".
   */
  field_keys: string[];            // subset of brand_config.fields to render in this step
}

interface PhotoUploadStep extends BaseStep {
  slots?: string[];
  min_photos?: number;
  max_photos?: number;
  recommended_photos?: number;
  /**
   * Where photos land. "brand" → brands.cover_image_url + brands.gallery_json.
   * "listing" → brand_products.image_url + brand_products.gallery_json.
   */
  writes_to: "brand" | "listing";
}

interface PreviewStep extends BaseStep {
  show_quality_score: boolean;
  show_live_preview: boolean;
}

interface DoneStep extends BaseStep {
  boost_tips?: string[];
}

// ── Storage config ──────────────────────────────────────────────────────────
export interface ProductStorageConfig {
  enabled: boolean;
  required: boolean;
  excel_upload: boolean;
  master_catalogue: boolean;
  /**
   * Declarative payload assembly. v0 had this as documentation only — v1
   * makes the renderer drive submit from this map.
   * LHS: target column on brand_products OR dotted path inside variants_json.
   * RHS: source — "wizard_state.foo" | "master_row.foo" | literal value.
   */
  storage_format: Record<string, string | StorageNestedSpec>;
  fields: FieldSchema[];           // overrides for individual columns
  excel_columns: ExcelColumnDef[];
}

interface StorageNestedSpec {
  [key: string]: "string" | "number" | "boolean" | "string[]" | StorageNestedSpec;
}

interface ExcelColumnDef {
  column: string;
  field: string;                   // attribute key, must exist in attributes_schema OR brand_config.fields
  required: boolean;
  example?: string;
}

export type QualityRule =
  | { field: string; points: number; label: string; scope?: "brand" | "listing" }
  | { items: string; min: number; points: number; label: string }
  | { type: "photos"; min: number; points: number; label: string; scope?: "brand" | "listing" };
```

### Plain-language explanation

A `ListingTemplate` defines **how a brand authors individual listing items**. The unit of a listing is one row in `brand_products` — one menu item, one service, one vehicle. Brand-level concerns (the restaurant's cuisines, the salon's team members, the rental company's GST number) live in `brand_config`, not here.

Implementers must:
- Declare every attribute key they reference (`attributes_schema`). The renderer can validate that every tag rule, spec_grid field, pricing tab field, and Excel column resolves to a declared key.
- Set `cart_scope` if `online_order` is in `availing_modes`. Restaurant must be `"brand"`. Otherwise `null`.
- Annotate each `ListingStep` with `writes_to` (or accept the default `"listing"`).
- Drive payload assembly from `product_config.storage_format` — no more imperative `handlePublish` building payloads by hand.

Implementers may:
- Compose any sequence of steps from the union above. New step types require simultaneously registering a renderer and adding the type to this contract.
- Use master_catalogue or skip it; salon and car_rental use it, restaurant does not.
- Mix `BrandFieldsStep` with listing steps freely (restaurant: brand fields → menu items → photos → preview).

### Mapping to car_rental

| Contract field | car_rental fulfilment |
|---|---|
| `attributes_schema` | NEW — must be added. Today the keys (`seats`, `fuel_type`, `transmission`, `sunroof`, `features`, `services`, `engine_cc`, `kmpl`, `ac`) are referenced across `card_config.tags`, `card_config.detail_sections`, and `variants_json.specs` with no central declaration. |
| `cart_scope` | `null` (car rental is prebook-only). |
| `card_type` | `"vehicle"` (was implicit in `card_config.card_type`). |
| `listing_steps[*].writes_to` | All `"listing"` — car_rental has no brand-level wizard steps today. (Brand profile is configured separately on dashboard/profile.) |
| `brand_config` | Empty `{ fields: {}, actions: [] }` for car_rental — listing-only category. Doesn't *require* brand-level CTAs. |
| `product_config.storage_format` | Already declared in [car_rental.json:271-300](inflx-platform/backend/public/schemas/car_rental.json) — but [CarRentalWizard.handlePublish:85-103](inflx-platform/Packages/brand-web/app/dashboard/products/components/car-rental/CarRentalWizard.js) ignores it. v1 requires the renderer to drive submit from this. |
| Everything else | Same as v0 mapping. |

### Restaurant illustrative sketch

```jsonc
{
  "category_key": "restaurant",
  "card_type": "menu_item",
  "product_noun": "Menu Item",
  "product_noun_plural": "Menu",
  "cart_scope": "brand",
  "availing_modes": ["pay_at_store", "online_order"],   // listing-level: order this dish
  "booking_type": null,                                  // listing has no booking; brand does (table)
  "attributes_schema": {
    "veg_flag": { "type": "veg_toggle", "label": "Veg/Non-Veg" },
    "section": { "type": "select", "label": "Section",
                 "options": ["Starters","Main Course","Breads","Rice & Biryani","Desserts","Beverages"] },
    "stock": { "type": "number", "label": "Daily stock" },
    "spice_level": { "type": "select", "label": "Spice", "options": ["Mild","Medium","Hot"] }
  },
  "listing_steps": [
    { "id": "brand_basics", "writes_to": "brand", "component": "brand_fields",
      "field_keys": ["cuisines", "hours_json", "address_line", "pincode", "gstin"] },
    { "id": "brand_dining", "writes_to": "brand", "component": "brand_fields",
      "field_keys": ["table_count", "parking", "dine_in_supported", "takeaway_supported"] },
    { "id": "menu", "writes_to": "listing", "component": "repeatable_items",
      "group_by_section": true,
      "item_fields": [
        { "key": "name", "type": "string", "label": "Item name", "required": true },
        { "key": "price", "type": "number", "label": "Price", "unit": "₹", "required": true },
        { "key": "veg_flag", "type": "veg_toggle", "label": "Veg/Non-Veg", "required": true },
        { "key": "section", "type": "select", "label": "Section",
          "options": ["Starters","Main Course","Breads","Rice & Biryani","Desserts"] }
      ] },
    { "id": "brand_photos", "writes_to": "brand", "component": "photo_upload",
      "min_photos": 3, "recommended_photos": 8 },
    { "id": "preview", "component": "preview",
      "show_quality_score": true, "show_live_preview": true }
  ]
  // brand_config and card_config follow — sketched in §2 / §3 below
}
```

### Salon illustrative sketch

```jsonc
{
  "category_key": "salon",
  "card_type": "service",
  "product_noun": "Service",
  "product_noun_plural": "Services",
  "cart_scope": null,                          // services booked one at a time
  "availing_modes": ["prebook"],               // listing-level: book this service slot
  "booking_type": "appointment",
  "features": { "master_catalogue": true, ... },
  "attributes_schema": {
    "duration_mins": { "type": "number", "label": "Duration", "unit": "min" },
    "section": { "type": "select", "label": "Category",
                 "options": ["Hair Men","Hair Women","Skin","Nails","Makeup","Spa"] },
    "stylist_required": { "type": "boolean", "label": "Specific stylist" }
  },
  "listing_steps": [
    { "id": "brand_basics", "writes_to": "brand", "component": "brand_fields",
      "field_keys": ["address_line", "hours_json", "pincode", "gstin", "gender_focus"] },
    { "id": "brand_team", "writes_to": "brand", "component": "brand_fields",
      "field_keys": ["team_members"] },          // type: "team_member_list"
    { "id": "service_picker", "writes_to": "listing", "component": "master_picker",
      "master_source": "master_services", "filter_by": "section" },
    { "id": "service_pricing", "writes_to": "listing", "component": "pricing",
      "price_fields": [
        { "key": "price", "label": "Service price", "unit": "₹", "required": true,
          "benchmark_source": "master_services",
          "benchmark_fields": ["price_min","price_max"] }
      ] },
    { "id": "preview", "component": "preview", "show_quality_score": true, "show_live_preview": true }
  ]
}
```

### Gaps and ambiguities

1. **`storage_format` enforcement.** v1 *requires* the renderer to drive submit from this map. That's a code change, not a schema change — flagged for the v1 implementation plan, not this doc. Until done, custom templates (car_rental) keep their imperative `handlePublish`.
2. **`team_member_list` field type is new.** Salon's `team_members` brand field needs a sub-form (name + photo + speciality + working hours per stylist). The renderer for this type doesn't exist yet. Specced here, deferred to salon implementation.
3. **Master catalogue: already supports salon. ~~`master_services` doesn't exist~~ — corrected v1.3.** [`master_salon_services`](inflx-platform/backend/migrations/005_master_catalogue.sql) is seeded (~50 services across Hair Men / Hair Women / Skin / Nails / Makeup / Spa) and [`GET /brands/me/master-catalogue`](inflx-platform/backend/src/controllers/brand.controller.js) already dispatches by `brand.category` to return the right master rows. The `?source=` query parameter speculation in v1.2 is dropped — implicit dispatch is the security boundary (see Patch Notes v1.3 entry). The `master_source` field on `MasterPickerStep` is documentation/sanity-check, not a wire format requirement; the renderer just calls `GET /brands/me/master-catalogue` and trusts the brand identity for routing. Bonus: the response annotates each master row with `is_activated` + `product_id` + `activated_price` for the brand, so the salon picker can natively grey out already-added services.
4. **`brand_config.fields` value persistence.** Lands in `brands.listing_data` (JSON column from migration 013). The shape inside that JSON is a flat `{ key: value }` keyed by `brand_config.fields[].key`. No new column needed.

---

## 2. BrandConfig Contract (NEW)

### Interface

```ts
/**
 * Brand-level configuration for a category. Sibling of ListingTemplate's
 * card_config. Holds typed brand fields (the data the brand owns once,
 * shared across all its listings) and brand-level CTAs (the actions a
 * follower takes against the brand, not against an individual listing).
 *
 * Lives at template.brand_config in the schema.
 */
export interface BrandConfig {
  /**
   * Typed brand-level fields. Restaurant's cuisines, hours, parking flags;
   * salon's team_members, gender_focus; clinic's specialties, qualifications.
   *
   * Values are persisted into brands.listing_data (JSON column, migration 013).
   * Renderer for BrandFieldsStep walks the keys referenced in the step.
   */
  fields: Record<string, FieldSchema>;

  /**
   * Brand-level actions shown on BrandStoreScreen. Discriminated union:
   * transactional actions flow through bookingService and inherit
   * TrackingContext; contact actions just open external apps.
   *
   * Renderer groups by `kind`: transactional first (stacked buttons),
   * contact beneath (icon row). Within each group, array order is
   * respected. See §5 "Renderer ordering rule (locked)".
   */
  actions: BrandActionItem[];

  /**
   * Optional declaration of brand-level photo requirements (cover image,
   * gallery). Wizard's PhotoUploadStep with writes_to: "brand" reads this.
   */
  photo_requirements?: {
    cover_required: boolean;
    gallery_min?: number;
    gallery_max?: number;
  };
}

export type BrandActionItem =
  | BrandTransactionalAction
  | BrandContactActionItem;

interface BrandTransactionalAction {
  kind: "transactional";
  action: BuyerAction;             // book_slot | walkin_pay | online_order | enquiry | external_link
  label: string;                   // CTA text — prescriptive
  /**
   * Per-action configuration. For book_slot at brand level (e.g. table
   * booking) this declares booking_type, fields, payment modes.
   */
  config: ActionConfig;
}

interface BrandContactActionItem {
  kind: "contact";
  action: BrandContactAction;      // call | whatsapp | directions | share
  label: string;
  /**
   * Where the contact target comes from. e.g. action="call" reads
   * brand_field "phone"; action="whatsapp" reads "whatsapp_phone";
   * action="directions" reads "address_line" + "latitude"/"longitude".
   */
  source_fields: string[];
}

export interface ActionConfig {
  booking_type?: BookingType;      // "table" for restaurant brand-level book_slot
  fields: string[];                // form fields the booking flow collects ("guest_count", "time_slot")
  payment_modes: ("token" | "full" | "none")[];
  token_amount?: number;
  token_refundable?: boolean;
  refund_policy?: string;
  balance_text?: string;
  /**
   * Backend endpoint that handles this action. Must match a real route.
   * Locked routes:
   *   "/follower/prebook"           — table + slot bookings (existing)
   *   "/follower/prebook-daterange" — date_range bookings (NEW)
   *   "/follower/orders"            — online_order (existing)
   *   "/follower/pay-at-store"      — walkin_pay (existing)
   *   "/follower/enquiry"                — enquiry (existing)
   * Action enum names (e.g. walkin_pay) are domain vocabulary; paths are URLs.
   * The two need not match.
   */
  endpoint: string;
}
```

### Plain-language explanation

`BrandConfig` is **everything the brand owns once and that's true across all its listings.** A restaurant has cuisines and table count and parking — those don't belong on each menu item. A salon has team members — those don't belong on each service. A car rental company has a garage address — every vehicle inherits it.

Implementers must:
- Declare every brand-level field referenced by `BrandFieldsStep.field_keys`.
- Specify `endpoint` for every transactional action — must match a real backend route. No polymorphic dispatch.
- For contact actions, declare which brand fields source the contact target (`call` reads `phone`; `directions` reads `address_line` + `latitude`/`longitude`).

Implementers may:
- Have an empty `fields` object and an empty `actions` array (car_rental: no brand-level transactions).
- Mix transactional and contact actions in any order. Renderer respects the order.

### Mapping to car_rental

| Contract field | car_rental fulfilment |
|---|---|
| `brand_config.fields` | `{}` — no category-specific brand fields beyond the standard `business_name`, `address_line`, `pincode`, `gstin` already on `brands` table. |
| `brand_config.actions` | `[ { kind: "contact", action: "call", source_fields: ["phone"] }, { kind: "contact", action: "whatsapp", source_fields: ["whatsapp_phone"] }, { kind: "contact", action: "directions", source_fields: ["address_line","latitude","longitude"] } ]` — Call/WhatsApp/Map already exist on `BrandStoreScreen.js`; v1 formalizes them as `BrandContactAction`. |
| `brand_config.photo_requirements` | `{ cover_required: true, gallery_min: 2 }` — the garage cover photo. |

### Restaurant illustrative sketch (BrandConfig portion)

```jsonc
"brand_config": {
  "fields": {
    "cuisines": { "type": "multi_select", "label": "Cuisines",
                  "options": ["North Indian","South Indian","Chinese","Continental","Biryani","Tandoor","Desserts"],
                  "required": true, "max": 4 },
    "hours_json": { "type": "string", "label": "Hours" },
    "table_count": { "type": "number", "label": "Tables" },
    "parking": { "type": "boolean", "label": "Parking available" },
    "dine_in_supported": { "type": "boolean", "label": "Dine-in" },
    "takeaway_supported": { "type": "boolean", "label": "Takeaway" }
  },
  "actions": [
    { "kind": "transactional", "action": "book_slot", "label": "Book Table",
      "config": {
        "booking_type": "table",
        "fields": ["booking_date","time_slot","guest_count"],
        "payment_modes": ["token","full"],
        "token_amount": 100, "token_refundable": true,
        "refund_policy": "100% refundable till 2hrs prior to slot",
        "endpoint": "/follower/prebook"
      } },
    { "kind": "transactional", "action": "walkin_pay", "label": "Walk-in & Pay",
      "config": {
        "fields": ["amount","tip_amount"],
        "payment_modes": ["full"],
        "endpoint": "/follower/pay-at-store"
      } },
    { "kind": "contact", "action": "call", "label": "Call",
      "source_fields": ["phone"] },
    { "kind": "contact", "action": "whatsapp", "label": "WhatsApp",
      "source_fields": ["whatsapp_phone"] },
    { "kind": "contact", "action": "directions", "label": "Get Directions",
      "source_fields": ["address_line","latitude","longitude"] }
  ]
}
```

### Salon illustrative sketch (BrandConfig portion)

```jsonc
"brand_config": {
  "fields": {
    "gender_focus": { "type": "select", "label": "Customer focus",
                      "options": ["Unisex","Women only","Men only"], "required": true },
    "hours_json": { "type": "string", "label": "Hours" },
    "team_members": { "type": "team_member_list", "label": "Team",
                      "min": 1 }
  },
  "actions": [
    { "kind": "transactional", "action": "walkin_pay", "label": "Walk-in & Pay",
      "config": {
        "fields": ["amount"], "payment_modes": ["full"],
        "endpoint": "/follower/pay-at-store"
      } },
    { "kind": "contact", "action": "call", "label": "Call",
      "source_fields": ["phone"] },
    { "kind": "contact", "action": "whatsapp", "label": "Book on WhatsApp",
      "source_fields": ["whatsapp_phone"] },
    { "kind": "contact", "action": "directions", "label": "Get Directions",
      "source_fields": ["address_line","latitude","longitude"] }
  ]
}
```

### Gaps and ambiguities

1. **`brands` table needs `phone` and `whatsapp_phone` columns.** `latitude` / `longitude` already exist (migration 015). `users.phone` is the brand owner's login phone, not a public business contact — `brands.phone` is a separate, publishable column. Migration required before brand-level contact actions can resolve their `source_fields`. Flag for v1 implementation.
2. **`team_member_list` storage shape** — array of `{ name, photo_url, role, speciality_tags[], schedule_json }`. Lives inside `brands.listing_data.team_members`. Sub-form needs renderer.
3. ~~Renderer ordering on BrandStoreScreen~~ — **resolved.** Locked in §5 "Renderer ordering rule": grouped by kind (transactional first as full-width buttons, contact beneath as icon row); intra-group order respects schema array.

---

## 3. BuyerCard Contract

### Interface

```ts
export interface BuyerCardProps {
  item: BuyerItem;
  template: TemplateBuyerHints;    // schema's card_config
  attribution?: AttributionLayer;
  tracking?: TrackingContext;      // hard requirement when card came via influencer link

  onPress: () => void;
  onPressPrimary: () => void;
  onPressSecondary?: () => void;
  onPressSave?: () => void;
}

export interface BuyerItem {
  id: string;
  name: string;
  subtitle_data: Record<string, string | number | boolean | undefined>;

  cover?: {
    image_url?: string;
    icon: string;                  // emoji fallback
    accent_bg?: string;
  };

  price: {
    amount: number;
    original_amount?: number;
    per_unit_label: string;        // "per day (24 hrs)", "per plate"
  };

  location?: { name: string; distance_text?: string };
  rating?: { value: number; review_count?: number };

  /**
   * UPDATED in v1. Was boolean; now structured. Card / detail page render
   * "Closed until 6pm" / "Out of stock today" instead of hiding the listing.
   */
  available: AvailabilityState;

  /**
   * All keys must be declared in template.attributes_schema.
   */
  attributes: Record<string, string | number | boolean | string[] | undefined>;
}

export interface AvailabilityState {
  orderable: boolean;
  reason?: string;                 // "Closed until 6pm", "Out of stock today", "Currently rented"
  resumes_at?: string;             // ISO 8601
}

export interface AttributionLayer {
  influencer_name: string;
  influencer_handle: string;
  influencer_initial: string;
  influencer_color: string;
  discount_value: number;
  discount_unit: "pct" | "abs";
  discount_label: string;          // pre-formatted: "10% OFF" or "₹100 OFF"
}

export interface TemplateBuyerHints {
  accent: string;
  accent_dim: string;
  icon: string;
  card_type: CardType;             // locked enum

  /**
   * PRESCRIPTIVE. Renderer MUST consume these — no per-card overrides in JS.
   */
  cta_primary:   { label: string; action: BuyerAction; color?: string };
  cta_secondary?: { label: string; action: BuyerAction };

  /**
   * PRESCRIPTIVE.
   */
  price_display: { source: string; unit: string };

  /**
   * PRESCRIPTIVE. v0 missed marking this prescriptive — v1 fixes that.
   * Source keys must exist in subtitle_data.
   */
  subtitle_template: string;

  /**
   * PRESCRIPTIVE. Renderer evaluates each rule against item.attributes.
   * Source keys must exist in template.attributes_schema.
   */
  tags: TagRule[];
}

export interface TagRule {
  source: string;
  format?: string;                 // "{value} seats"
  text?: string;                   // for boolean attributes
  show_if?: boolean | string;
  highlight_if?: string;           // expression: "value >= 7"
  highlight?: boolean;
  use_first?: boolean;
  show_first?: number;
}
```

### Plain-language explanation

Discovery surface for a single listing item. The contract has two halves: a category-agnostic `BuyerItem` (the data) and a `TemplateBuyerHints` block (how the schema controls rendering). With `subtitle_template`, `tags[]`, and the CTA labels now **prescriptive**, the React Native card has no business carrying its own copy of those — they come from the schema.

Visual treatment of the cover area (vehicle SVG, food photo, salon shot grid) is **advisory** — templates can style the hero however they want. Everything else is prescriptive.

### Mapping to car_rental

Same as v0 mapping with these v1-specific notes:
- `available` upgrades from the hardcoded "Available" pill on `CarRentalCard.js:71-74` to consuming `AvailabilityState` from the item.
- `subtitle_template`, `tags[]`, `cta_primary.label`, `cta_secondary.label` move from JS hardcoding into schema consumption — biggest single refactor required.
- `card_type` adds explicit `"vehicle"` enum value.
- `tracking` becomes a required prop when the card was rendered from an influencer-link entry.

### Gaps and ambiguities

1. **`available.reason` localization.** "Closed until 6pm" is English. For Phase B (Vijayawada) Telugu may be needed. v1 punts — strings in the AvailabilityState are server-formatted in English. Flag for future i18n pass.
2. **`AvailabilityState` source.** Backend computes `available.orderable` from existing `availability_json` + current time + `stock`. Endpoint that returns the buyer-side card list must compute this; mobile doesn't compute it.
3. **Highlighting expression DSL.** `highlight_if: "value >= 7"` is a tiny expression language. Today no parser exists — `CarRentalCard.js:23` hardcodes `seats >= 7`. v1 needs a minimal evaluator (only `==`, `!=`, `>=`, `<=`, `>`, `<`, plus boolean checks). Out of scope for this doc; flagged for v1 implementation.

---

## 4. BuyerDetail Contract

### Interface

```ts
export interface BuyerDetailProps {
  item: BuyerItem;
  template: TemplateDetailHints;
  attribution?: AttributionLayer;
  tracking?: TrackingContext;

  onActionPrimary: (action: BuyerAction, ctx: ActionContext) => void;
  onActionSecondary?: (action: BuyerAction, ctx: ActionContext) => void;
  onShare?: () => void;
  onSave?: () => void;
  /**
   * Navigation back to the brand store. MUST forward TrackingContext so
   * brand-level CTAs inherit attribution from this entry.
   */
  onOpenBrandStore: (brandId: string, tracking?: TrackingContext) => void;
}

export interface TemplateDetailHints extends TemplateBuyerHints {
  detail_sections: DetailSection[];
  booking_config: BookingConfig;   // for the listing-level primary CTA
}

// ── Detail section primitives ───────────────────────────────────────────────

export type DetailSection =
  | SpecGridSection
  | FeatureChipsSection
  | PricingTabsSection
  | PickupOptionsSection
  | GallerySection
  | RepeatableListSection
  | DescriptionSection;
// ContactSection REMOVED — moved to BrandConfig.actions.

interface SpecGridSection {
  type: "spec_grid";
  title: string;
  fields: string[];                // attribute keys; must exist in attributes_schema
  emphasized_field?: { key: string; color: "green" | "amber" | "red" };
}

interface FeatureChipsSection {
  type: "feature_chips";
  title: string;
  source: string;                  // attribute key, must be string[]
}

interface PricingTabsSection {
  type: "pricing_tabs";
  title: string;
  tabs: PricingTab[];
}

interface PricingTab {
  key: string;
  label: string;
  fields: string[];
  derived?: Record<string, string>; // formula DSL — not implemented in v1
}

interface PickupOptionsSection {
  type: "pickup_options";
  title: string;
  options: Array<{ key: string; label: string; sub: string; extra_charge?: number }>;
}

interface GallerySection {
  type: "gallery";
  title?: string;
  source: string;                  // attribute key — image URL array
  layout: "carousel" | "grid";
}

interface RepeatableListSection {
  type: "repeatable_list";
  title: string;
  source: string;
  item_template: "menu_row" | "service_row" | "package_card";
}

interface DescriptionSection {
  type: "description";
  title?: string;
  source: string;
}

// ── Booking flow ────────────────────────────────────────────────────────────

export interface BookingConfig {
  type: BookingType;
  fields: string[];
  payment_modes: ("token" | "full")[];
  token_amount?: number;
  token_refundable?: boolean;
  refund_policy?: string;
  balance_text?: string;
  /**
   * NEW in v1. Dedicated endpoint per booking type. No polymorphic dispatch.
   */
  endpoint: string;
}

export interface ActionContext {
  tracking?: TrackingContext;
  selected_options?: Record<string, unknown>;
  payment_mode?: "token" | "full";
}
```

### Plain-language explanation

Full-screen page for one listing item. Composed from a small library of section primitives declared in `template.detail_sections`. Sticky CTA region runs the listing's `BookingConfig.endpoint`. Brand-level CTAs (Call, WhatsApp, Get Directions, Book Table) do NOT appear here — they appear on `BrandStoreScreen`. Users reach the brand store via an explicit "View Brand" affordance (top of page, navigation chevron, or back button) — and that nav MUST forward `TrackingContext`.

`ContactSection` is intentionally absent. Phone, WhatsApp, and address are brand attributes; rendering them per-listing duplicates them across every menu item.

### Mapping to car_rental

| Contract field | car_rental fulfilment |
|---|---|
| `SpecGridSection` with `Insurance` emphasized green | `card_config.detail_sections[0]` → [CarDetailScreen.js:124-139](inflx-platform/Packages/Mobile/src/screens/follower/CarDetailScreen.js); `emphasized_field` newly formalized in v1 |
| `FeatureChipsSection` source `specs.features` | unchanged |
| `PricingTabsSection` 3 tabs | unchanged; `derived` formula DSL still deferred |
| `PickupOptionsSection` | unchanged |
| `BookingConfig.endpoint` | `"/follower/prebook-daterange"` — NEW route, replaces today's `/follower/prebook` shoehorn for date_range bookings (where car_rental serializes duration + pickup into a `notes` string) |
| `BookingConfig.payment_modes: ["token","full"]` | resolved from v0's schema/UI mismatch — UI was right, schema was wrong; v1 schema declares both |
| `onOpenBrandStore` with tracking forwarding | NEW requirement — today there's no BrandStore navigation from CarDetailScreen |

### Gaps and ambiguities

1. **`derived` formula DSL still not specced.** Car_rental's self-drive multipliers (`× 0.67`) remain hardcoded in [CarDetailScreen.js:46-67](inflx-platform/Packages/Mobile/src/screens/follower/CarDetailScreen.js). Options: (a) JS expression sandbox, (b) limited operator language, (c) per-template hook. Defer to v2 unless restaurant or salon needs it (they probably don't).
2. **Section ordering with brand-level CTA reachability.** A user landing on a dish detail must be able to reach the brand store to "Book a table." Today there's no chevron / "View restaurant" affordance. Renderer must add a standard top-of-detail brand link (with tracking forwarding) regardless of `detail_sections` content.
3. **`RepeatableListSection`** — declared for completeness but no current category uses it on a *listing* detail page. It surfaces on BrandStoreScreen instead (the menu list, the service list).

---

## 5. BrandStoreView Contract (NEW)

### Interface

```ts
/**
 * The brand's store page. Shows brand profile, brand-level actions
 * (transactional + contact), and the brand's listings grouped by section.
 *
 * NEW in v1 because brand-level CTAs and TrackingContext propagation
 * needed a formal home.
 */
export interface BrandStoreViewProps {
  brand: BrandViewModel;
  template: TemplateBuyerHints & { brand_config: BrandConfig };
  listings: BuyerItem[];           // brand_products rows for this brand
  tracking?: TrackingContext;      // see propagation rules below

  onPressListing: (item: BuyerItem) => void;
  onAction: (action: BrandActionItem, ctx: ActionContext) => void;
}

export interface BrandViewModel {
  id: string;
  name: string;                    // brands.business_name
  category: string;                // brands.category
  cover_image_url?: string;
  gallery_urls?: string[];
  rating?: { value: number; review_count: number };
  location: {
    address_line: string;
    pincode: string;
    distance_text?: string;
    latitude?: number;
    longitude?: number;
  };
  /**
   * Brand-level field values. Keys must match template.brand_config.fields.
   * Sourced from brands.listing_data.
   */
  brand_data: Record<string, unknown>;

  /**
   * Contact targets resolved from brand fields. Renderer reads these for
   * BrandContactAction without re-resolving source_fields.
   */
  contact: {
    phone?: string;
    whatsapp_phone?: string;
  };
}
```

### TrackingContext propagation rules (NEW, hard requirement)

Two entry paths to `BrandStoreScreen`. Both MUST thread tracking through.

**Path A — direct influencer-link entry**
- URL: `/s/{influencer_handle}` (no `oid` query param)
- Outcome: lands on the brand's store
- `TrackingContext` constructed from `cid`, `sid`, `iid` query params
- Sits on every transactional brand action (Book Table, Walk-in Pay)
- When follower books a table, `prebook-table` writes `follower_transactions` with this tracking

**Path B — listing-detail back-nav / explicit "View restaurant"**
- User entered via `/s/{handle}?cid=...&iid=...&oid={offer_id}` → landed on a dish detail → taps "View restaurant"
- `TrackingContext` inherited from the listing entry, NOT regenerated
- `BuyerDetail.onOpenBrandStore(brandId, tracking)` forwards it to `BrandStoreScreen`
- Brand-level actions inherit the tracking — so a "shared a dish, booked a table" path attributes correctly

**Implementation requirements:**
1. `BrandStoreScreen` accepts a `tracking` route param (today it doesn't).
2. The brand store route handler reads `cid`/`sid`/`iid` from URL query params on direct entry.
3. `BrandStoreScreen` passes `tracking` into every `onAction` handler.
4. `BuyerDetail` adds an "View [brand]" navigation affordance that calls `onOpenBrandStore(brandId, tracking)`.
5. Listing detail entry (`/s/{handle}?...&oid=X` → `CarDetailScreen` etc.) already has tracking — confirm forwarding intact.

### Renderer ordering rule (locked)

`BrandStoreScreen` MUST group `BrandConfig.actions` by `kind`:
- **Transactional actions render first** as full-width buttons stacked vertically (one per row).
- **Contact actions render beneath** as a single horizontal icon row.
- Within each group, schema array order is respected.

Schema authors do not control cross-group ordering. They control intra-group ordering by where they place items inside `actions[]`. This keeps every brand store visually consistent — Book Table / Walk-in Pay always look like primary CTAs, Call / WhatsApp / Directions always look like secondary chrome, regardless of category.

### Mapping to car_rental

| Contract field | car_rental fulfilment |
|---|---|
| `BrandStoreView` for car_rental | Today: `BrandStoreScreen.js` shows products list grouped by section + Call/WhatsApp/Map. v1: same UI, formalized as `brand_config.actions` driving the rendering. |
| `tracking` route param | NOT YET WIRED. v1 implementation requirement. |
| "View restaurant" affordance from `CarDetailScreen` | Doesn't exist. Lower priority for car_rental (no brand-level transaction); higher priority for restaurant. |

### Gaps and ambiguities

1. **`BrandStoreScreen` is currently shared across categories** ([BrandStoreScreen.js](inflx-platform/Packages/Mobile/src/screens/follower/BrandStoreScreen.js)). v1 keeps it shared; the contract says the screen is template-agnostic and reads `brand_config` for action wiring. Per-category visual variation (restaurant menu grouping vs car-rental fleet grid) is template-controlled via `card_type` rendering inside the listing list.
2. **Default tracking when neither path A nor B applies.** A user organically browsing (no influencer entry) has no tracking. `tracking` is optional; brand actions still work, just no commission attribution. Existing platform-direct revenue model unchanged.

---

## 6. Booking endpoint conventions

Locked to real existing routes plus one new route. All transactional routes write to `follower_transactions` via the existing `transaction.service.js` core (`validateTracking`, `createOrder`, `verifyPaymentSignature`, `creditInfluencerCommission`).

| Endpoint | BookingType / Action | Status | Used by |
|---|---|---|---|
| `POST /follower/prebook` (+ `/verify`) | `table` + `appointment` / `slot` | **existing**, polymorphic on `offer_id` (slot capacity check runs when `offer_id` present) | restaurant brand-level book_slot, salon / clinic / fitness listing-level book_slot |
| `POST /follower/prebook-daterange` (+ `/verify`) | `date_range` | **NEW** — only genuinely missing route | car_rental listing-level (replaces today's shoehorn through `/follower/prebook` with duration + pickup serialized into `notes`) |
| `POST /follower/orders` (+ `/verify`) | `online_order` | **existing** | restaurant menu items (cart_scope: brand), future commerce |
| `POST /follower/pay-at-store` (+ `/verify`) | `walkin_pay` | **existing** — semantic equivalent of contract's earlier `/walkin-pay` naming | brand-level for restaurant, salon, car_rental |
| `POST /follower/enquiry` | `enquiry` | **existing** | wedding vendors, real estate (Phase C+) |
| `GET /follower/slots` | slot availability lookup | **existing** | called by frontends before showing slot picker |
| `GET /brands/me/orders` | brand-side order management | **existing** | brand dashboard (covers pay_at_store + prebook + online_order) |

**Action enum names ≠ route paths.** The `BuyerAction` enum (`walkin_pay`, `book_slot`, `online_order`, `enquiry`, `external_link`) is domain vocabulary for what the user is doing. The route paths are URLs. They don't need to match. `walkin_pay` action posts to `/follower/pay-at-store`; `book_slot` action posts to either `/follower/prebook` (table/slot) or `/follower/prebook-daterange` (car_rental), based on `BookingType`.

**Common payload contract (every transactional endpoint):**
```ts
{
  // Tracking — non-negotiable, drives commission
  campaign_id?: string;
  set_id?: string;
  offer_id?: string;
  campaign_influencer_id?: string;

  // Target — at least one
  brand_id?: string;               // brand-level actions
  product_id?: string;             // listing-level actions
  cart?: Array<{ product_id: string; qty: number; variant?: string }>;  // online_order

  // Booking-type-specific details — typed per endpoint
  details: { /* shape varies — see per-endpoint specs */ };

  // Payment
  payment_mode: "token" | "full" | "none";
  amount_rupees: number;           // backend converts to paise for Razorpay
}
```

**Shared service core (existing — already does the heavy lifting):**
- `transaction.service.js` — `validateTracking`, `createOrder`, `consumeMockOrder`, `verifyPaymentSignature`, `calcPayAtStore`, `calcOnlineOrder`, `creditInfluencerCommission`. Used by every transactional controller today.
- `booking.service.js` — `getSlots`, `generateReferenceCode`. Currently only handles slot-based bookings; v1.1 extends with date_range support for the new `/follower/prebook-daterange` route.

**v1.1 implementation work:**
1. Add `POST /follower/prebook-daterange` + `/verify` route + controller, modeled on existing `initiatePrebook` / `verifyPrebook` but with `details: { pickup_date, return_date, duration_days, pickup_type }` instead of `{ booking_date, booking_time, guest_count }`. Reuses `validateTracking`, `createOrder`, `verifyPaymentSignature`, `creditInfluencerCommission` unchanged.
2. Extend `bookingService` with a `recordDateRangeBooking` writer (analogous to today's table-booking insert into `follower_bookings` — likely needs a new table or columns for date_range fields).
3. Mobile `CarBookingScreen.handlePay` switches from `/follower/prebook` to `/follower/prebook-daterange`; stops cramming duration + pickup into `notes`.

The existing `/follower/prebook` keeps serving table + slot bookings unchanged. No deprecation needed.

---

## 6.5. Template Runtime Contract (NEW in v1.3)

The schema (§1–§5) defines what a template *is*. This section defines how a template *plugs into the renderer*. PR-A's [`templateRegistry.js`](inflx-platform/Packages/brand-web/app/dashboard/products/components/templateRegistry.js) and [`builtinStepComponents.js`](inflx-platform/Packages/brand-web/app/dashboard/products/components/builtinStepComponents.js) are the implementation; this section is the contract those implementations satisfy.

### Registry contract

Each template module is a plain object exporting any subset of:

```ts
interface TemplateModule {
  /**
   * snake_case step.component name → React component.
   * Used to dispatch wizard step content for template-specific steps.
   * Layout falls back to builtinStepComponents for any name not present here.
   */
  stepComponents?: Record<string, React.ComponentType<StepProps>>;

  /**
   * Renders one row in the brand's fleet/menu/services list view.
   * If absent, layout uses a default spec-less row.
   */
  FleetRowComponent?: React.ComponentType<{ product: BrandProduct; onRemove: () => void }>;

  /**
   * Optional override of the default storage_format-driven publishDriver.
   * Use only when payload shape is too complex to express declaratively
   * (e.g. car_rental's master_vehicle_id + nested variants_json.specs).
   */
  customPublish?: (ctx: { template, brand, wizardState, wizardItems }) => Promise<PublishResult>;

  /**
   * Seeds wizard state on entry to the add flow. Useful for templates with
   * default field values (security_deposit: 5000, extra_km_charge: 12, etc.).
   */
  initialWizardState?: () => Record<string, unknown>;

  /**
   * NEW in v1.3 — per-step validation hook called before wizard advances.
   * Returns true to allow Next, false to block. Used for restaurant's
   * min_items gate, salon's price/duration gates, car_rental's day_rate > 0.
   *
   * If absent, layout permits all moves (today's PR-A default — restaurant
   * and salon will exercise this in PR-B).
   */
  canProceed?: (wizardState: object, step: ListingStep, wizardItems?: object[]) => boolean;
}
```

### `step.component` enumeration (locked in v1.3)

Schema JSON uses **snake_case** for `component` values. The TS interface names (PascalCase) in §1 are types — they describe the *shape* of the step config, not the dispatch key.

| JSON `component` value | TS interface (in §1) | Source | Exercised by |
|---|---|---|---|
| `option_grid` | `OptionGridStep` | template registry | car_rental's `VehicleTypeSelector` |
| `master_picker` | `MasterPickerStep` | template registry | car_rental's `MakeModelPicker`; salon's service picker (PR-B) |
| `spec_confirmation` | `SpecConfirmationStep` | template registry | car_rental's `SpecConfirmation` |
| `pricing` | `PricingStep` | template registry | car_rental's `CarPricingForm`; salon's price step (PR-B) |
| `repeatable_items` | `RepeatableItemStep` | built-in | restaurant menu, salon services (PR-B) |
| `brand_fields` | `BrandFieldsStep` | built-in | restaurant + salon brand-level fields (PR-B) |
| `photo_upload` | `PhotoUploadStep` | built-in | every template (R2 wiring deferred — see §9) |
| `preview` | `PreviewStep` | built-in | every template's penultimate step |
| `done` | `DoneStep` | built-in | every template's success step |
| `basic_fields` | *(no formal interface)* | built-in **(deprecated v1.3)** | 35 legacy generic categories — **see sunset path below** |

### `basic_fields` deprecation (sunset path)

`basic_fields` is the legacy generic step DynamicStepRenderer dispatched on; PR-A keeps it in `builtinStepComponents.js` for back-compat with the 35 generic categories whose schemas declare no explicit step types. **It is deprecated as of v1.3 with a documented sunset:**

1. **PR-A (current):** `basic_fields` continues to render. Deprecation flag is documentation-only — no runtime warning yet.
2. **PR-B:** new templates (restaurant, salon) MUST NOT use `basic_fields`. Lint check optional.
3. **PR after PR-B (named: PR-D-legacy-migration):** the 35 generic legacy categories are migrated to explicit step types (`brand_fields`, `repeatable_items`, `preview`, `done`). `basic_fields` is removed from `builtinStepComponents.js` exports.

The sunset is a contract claim with teeth: when PR-D ships, the legacy categories MUST be migrated or they break. No "deprecated forever" purgatory.

### Layout-rendered niceties (NEW in v1.3)

These are layout-side contract guarantees, not template responsibilities:

- **Brand-step skip header link.** When `canSkipBrandSteps(template, brand, products)` returns true and brand steps are elided, the layout header shows "Edit business profile" — the only re-entry path. Inline navigation that bypasses the skip predicate is forbidden by design (would force every step component to handle a brand-mode toggle; one affordance, one route, one mental model).
- **Repeatable-step "for {brand_name}" header.** When brand steps are auto-skipped AND the current step is `repeatable_items`, the renderer prepends a small `for {brand_name}` header so the brand sees context they would otherwise have just walked through. Prevents the orphaned-feeling "+ Add menu item" surface that PR-A recon flagged.
- **`canProceed` invocation.** Layout calls `templateModule.canProceed(wizardState, currentStep, wizardItems)` before advancing. Returning false suppresses the Next button (ghost state); returning true (or absent hook) permits.

### Why this contract lives outside §1–§5

§1–§5 are **schema-author** contracts — what JSON authors write to declare a category. The Template Runtime Contract is a **template-implementer** contract — what code authors write when a category needs custom step components or fleet rendering. Most categories don't have implementers; they live entirely in JSON + built-ins. Three categories will (car_rental today; restaurant + salon in PR-B); future verticals like wedding might add more.

---

## 7. Resolved decisions log

| ID | Question | Resolution |
|---|---|---|
| Q1 | Restaurant model: restaurant=listing or item=listing? | **item=listing.** Restaurant = brand. Add `BrandConfig`. |
| Q2 | `card_config` fields prescriptive or advisory? | **Prescriptive** for `tags`, `cta_primary.label`, `cta_secondary.label`, `subtitle_template`. **Advisory** for visual treatment (cover layout, accent application). |
| Q3 | Photo upload — per-template config or platform-wide? | Platform-wide *mechanics* (R2 wrapper, shared upload UI). Per-template *requirements* (slot names, min count, aspect ratios) via `PhotoUploadStep` and `BrandConfig.photo_requirements`. |
| Q4 | Booking endpoints — polymorphic or dedicated? | **Dedicated** per `BookingType` + per transactional action. Six endpoints (see §6). Shared service core. |
| Q5 | Brand profile = listing? | **Dissolved by Q1.** Brand profile is the parent; listings are children. No conceptual conflict. |
| Q6 | Action type enum — locked? | **Locked.** `BuyerAction` (5 transactional). `BrandContactAction` (4 contact-only). Listing-vs-brand distinction handled by attachment surface, not enum value. |
| Q7 | `card_type` enum | **Locked.** `vehicle | menu_item | service | package | product | vendor_portfolio`. |
| Q8 | `detail_sections` ordering | **Template-controlled.** Renderer respects array order. |

**Refinements added in v1 from chat review:**
- Shared `FieldSchema` lifted out of v0's `FieldDef`; used by `attributes_schema`, `brand_config.fields`, generic `fields[]`, Excel column bindings.
- `cart_scope` on `ListingTemplate` for online_order mixing.
- `AvailabilityState` (`{ orderable, reason?, resumes_at? }`) replaces boolean.
- Action enum split into `BuyerAction` + `BrandContactAction`.
- `writes_to` on `ListingStep` (derived from chat's restaurant wizard sketch).
- `BrandStoreView` formalized + tracking propagation paths A/B.

---

## 8. Open questions for v2

These are deferred — not blockers for restaurant + salon authoring against v1.

1. **`derived` formula DSL** for `PricingTabsSection`. car_rental hardcodes self-drive multipliers; restaurant + salon don't need this.
2. **Localization of `available.reason`.** v1 ships English-only.
3. **`team_member_list` sub-form renderer.** Specced as a `FieldType` value; renderer to be implemented during salon build.
4. **Brand-direct entry without influencer (organic discovery).** Tracking propagation rules cover Path A and Path B but not "user opens INFLX, browses categories, no influencer involved." Existing platform-direct revenue model handles this; flagged for explicit confirmation during restaurant launch.
5. **Cart persistence across navigation** for `cart_scope: "brand"` (restaurant). Does cart survive a back-out to brand store and re-entry to a different dish? Likely yes; not specced.

---

## 9. Files referenced

**Existing implementation (v0 mapping basis)**
- [backend/public/schemas/car_rental.json](inflx-platform/backend/public/schemas/car_rental.json)
- [Packages/brand-web/app/dashboard/products/components/car-rental/CarRentalWizard.js](inflx-platform/Packages/brand-web/app/dashboard/products/components/car-rental/CarRentalWizard.js)
- [Packages/brand-web/app/dashboard/products/components/car-rental/MakeModelPicker.js](inflx-platform/Packages/brand-web/app/dashboard/products/components/car-rental/MakeModelPicker.js)
- [Packages/brand-web/app/dashboard/products/components/car-rental/VehicleTypeSelector.js](inflx-platform/Packages/brand-web/app/dashboard/products/components/car-rental/VehicleTypeSelector.js)
- [Packages/brand-web/app/dashboard/products/components/car-rental/CarPricingForm.js](inflx-platform/Packages/brand-web/app/dashboard/products/components/car-rental/CarPricingForm.js)
- [Packages/brand-web/app/dashboard/products/components/car-rental/SpecConfirmation.js](inflx-platform/Packages/brand-web/app/dashboard/products/components/car-rental/SpecConfirmation.js)
- [Packages/Mobile/src/components/cards/CarRentalCard.js](inflx-platform/Packages/Mobile/src/components/cards/CarRentalCard.js)
- [Packages/Mobile/src/screens/follower/CarDetailScreen.js](inflx-platform/Packages/Mobile/src/screens/follower/CarDetailScreen.js)
- [Packages/Mobile/src/screens/follower/CarBookingScreen.js](inflx-platform/Packages/Mobile/src/screens/follower/CarBookingScreen.js)
- [Packages/Mobile/src/screens/follower/BrandStoreScreen.js](inflx-platform/Packages/Mobile/src/screens/follower/BrandStoreScreen.js) — touched by v1 tracking propagation requirement

**Scope clarification — platform-level vs category-specific brand fields:**

Platform-level brand fields (`phone`, `whatsapp_phone`, `latitude`, `longitude`, `gstin`, `address_line`, `pincode`, `business_name`, `logo_url`) are captured during **brand onboarding**, not inside any category wizard. They live as columns on the `brands` table and are the same for every category.

Category-specific `BrandFieldsStep` instances reference **only their own category's brand fields** — restaurant references `cuisines`, `table_count`, `parking`, `dine_in_supported`, `takeaway_supported`; salon references `gender_focus`, `team_members`. These live inside `brands.listing_data` (JSON), keyed by `brand_config.fields[].key`.

Consequently the `brands` table migration adding `phone` and `whatsapp_phone` is a **platform work item**, not a restaurant- or salon-specific one — it unblocks every category's `BrandContactAction` resolution simultaneously. (`latitude` and `longitude` already exist as of [migration 015](inflx-platform/backend/migrations/015_brand_location.sql).)

---

**Migration touchpoints — v1.1 reality-aligned list:**

*Three real items to ship now (chat-side schema authoring is not blocked on any of these):*

1. **`brands` columns:** add `phone varchar(15)` + `whatsapp_phone varchar(15)`. Single-file SQL migration. Unblocks `BrandContactAction.source_fields` resolution. (`latitude` + `longitude` from migration 015 cover the directions action.)

2. **`POST /follower/prebook-daterange`** + `/verify` route + controller modeled on existing `initiatePrebook` / `verifyPrebook`. Extend `booking.service.js` with date_range writer. Mobile `CarBookingScreen.handlePay` switched from `/follower/prebook` shoehorn to the new route.

3. **`<ListingTemplateLayout>`** extracted from `CarRentalWizard.js`. Pure refactor; behavior unchanged. Templates ship only their per-step components going forward.

*Deferred until restaurant schema lands (so design has a real schema to drive against):*

4. `BrandStoreScreen.js` — accept `tracking` route param, thread to brand actions; group `BrandConfig.actions` by `kind` per §5 ordering rule. Needs concrete `brand_config.actions[]` from restaurant.json to test against.

5. Brand onboarding flow — capture `phone` + `whatsapp_phone` alongside existing fields. Likely benefits from coordinating with restaurant onboarding screens chat will design.

*Per-template refactors (out of platform-level scope, scheduled with their template):*

- `CarRentalCard.js` — refactor to consume `template.card_config` instead of carrying its own subtitle/tag/cta logic. Naturally lands when first new template card (RestaurantCard / SalonCard) is built — both reuse the abstraction.
- `CarRentalWizard.handlePublish` — drive submit from `product_config.storage_format`. Lands when generic submit driver is added to `<ListingTemplateLayout>`.

*Recon complete — no work needed:*

- ~~`/brands/me/master-catalogue` endpoint — extend to dispatch on `?source=` query.~~ **Dropped in v1.3.** Endpoint already dispatches by `brand.category`; the seeded `master_salon_services` table covers salon's needs. Restaurant doesn't use master catalogue at all (`features.master_catalogue: false`). The brand-identity dispatch IS the authorization boundary — refactoring to explicit `?source=` would reintroduce the security gap that doesn't exist today. Future engineers MUST NOT do this.
