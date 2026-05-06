# Contracts Specification (v0)

> Status: **draft for review**. Reverse-engineered from `car_rental` (the only category with a fully custom end-to-end implementation today). These contracts define what every future template (restaurant, salon, wedding, etc.) must satisfy so the codebase doesn't fork into N mini-codebases.

**Codebase note:** the project is JavaScript (no TypeScript, no Zod / io-ts / Joi / yup found in any `package.json`). The interfaces below are written in TypeScript as a *specification language*. They are not enforced at runtime today. A JSON Schema sidecar can be derived from them later if we want runtime validation against `backend/public/schemas/*.json` — recommended but out of scope for this spec.

**Three contracts:**

1. **ListingTemplate** — how a brand authors a listing (brand-web wizard)
2. **BuyerCard** — how a listing appears as a card on the follower app (discovery)
3. **BuyerDetail** — how a listing appears as a full detail page on the follower app, including the action flow that follows the primary CTA

---

## 1. ListingTemplate Contract

### Interface (TypeScript)

```ts
/**
 * A ListingTemplate defines how a brand authors items (vehicles, menu items,
 * services, packages, etc.) for a given category. It drives the wizard UI,
 * the validation, and the storage shape written into `brand_products`.
 *
 * The schema JSON in backend/public/schemas/{category_key}.json is the single
 * source of truth. The brand-web renderer reads it and dispatches to either:
 *   - the generic DynamicStepRenderer (current default for 35 of 36 categories), OR
 *   - a custom React component tree (today: car-rental only).
 */
export interface ListingTemplate {
  // ── Identity ──────────────────────────────────────────────────────────────
  category_key: string;            // unique key, matches filename
  label: string;                   // human-facing category name ("Car Rental")
  icon: string;                    // emoji shown in tabs / cards ("🚗")
  product_noun: string;            // singular ("Vehicle") — used in CTAs / labels
  product_noun_plural: string;     // plural ("Fleet") — used in counts
  super_category: string;          // grouping for follower discovery ("travel", "eat", "beauty")
  phase: 1 | 2 | 3 | 4;            // gating: which build phase exposes this
  status: "active" | "preview" | "disabled";

  // ── Capability flags ──────────────────────────────────────────────────────
  // Drive feature toggles inside the renderer. Today this is `features` in
  // the JSON; long-term every flag below should be derivable from the wizard
  // step list and not duplicated, but for v0 we keep it for back-compat.
  features: {
    sections: boolean;             // does the brand assign items to sections?
    veg_flag: boolean;             // food-only veg/non-veg toggle
    duration_mins: boolean;        // service duration field?
    variants: boolean;             // does an item have priced sub-variants?
    stock: boolean;                // is daily/total stock a concept?
    booking: boolean;              // does this category support pre-booking?
    enquiry_only: boolean;         // is enquiry the only conversion path?
    availability: boolean;         // weekday/date availability picker?
    master_catalogue: boolean;     // are items selected from a platform-curated master?
  };

  // ── Sections (item taxonomy) ──────────────────────────────────────────────
  sections: string[];              // e.g. ["Hatchback", "Sedan", "SUV"]

  // ── Modes the buyer can transact through ──────────────────────────────────
  availing_modes: AvailingMode[];   // ["pay_at_store", "online_order", "prebook"]
  booking_type?: BookingType;       // "table" | "appointment" | "date_range" | "slot"

  // ── Wizard definition ─────────────────────────────────────────────────────
  /**
   * The brand-side authoring flow. Each step renders either a built-in step
   * type (DynamicStepRenderer reads `component` and looks it up in a
   * step-component registry) or a custom React component delivered by the
   * template package (e.g. car-rental's VehicleTypeSelector).
   */
  listing_steps: ListingStep[];

  // ── Per-item fields (legacy generic form) ─────────────────────────────────
  /**
   * Used by the generic DynamicFieldRenderer / ProductFormModal. Custom
   * templates (car_rental) ignore this and gather the same data through
   * their wizard. Should be considered LEGACY for any template that ships
   * a `listing_steps` array.
   */
  fields: FieldDef[];

  // ── How wizard state is persisted to brand_products ───────────────────────
  /**
   * Declarative mapping from wizard form state to the columns/JSON of
   * `brand_products`. Today only car_rental defines this; everywhere else
   * the mapping is implicit in DynamicStepRenderer's submit handler.
   */
  product_config: ProductStorageConfig;

  // ── Buyer-side rendering hints (consumed by BuyerCard / BuyerDetail) ──────
  buyer_config: BuyerConfig;       // see BuyerCard contract
  card_config: CardConfig;         // see BuyerCard contract
  action_types: ActionTypeMap;     // see BuyerDetail contract

  // ── Quality / completeness scoring ────────────────────────────────────────
  quality_rules: QualityRule[];
}

// ── Step definitions ────────────────────────────────────────────────────────

export type ListingStep =
  | OptionGridStep
  | MasterPickerStep
  | SpecConfirmationStep
  | PricingStep
  | RepeatableItemStep
  | PhotoUploadStep
  | PreviewStep
  | DoneStep;

interface BaseStep {
  id: string;                      // unique within template ("vehicle_type", "make_model")
  title: string;                   // shown above the step content
  subtitle?: string;               // shown beneath the title
  /**
   * Component identifier. The brand-web renderer maps this string to either
   * a built-in component (DynamicStepRenderer's registry) or to a template-
   * specific component bundle (car-rental package).
   */
  component: string;
}

interface OptionGridStep extends BaseStep {
  // car_rental: VehicleTypeSelector
  options: Array<{
    value: string;
    label: string;
    sub?: string;                  // 1-line description
    icon?: string;                 // icon key (renderer maps to SVG)
  }>;
}

interface MasterPickerStep extends BaseStep {
  // car_rental: MakeModelPicker
  master_source: string;           // "master_vehicles" — backing table / endpoint
  filter_by?: string;              // column on master to filter by ("segment")
  makes?: string[];                // optional curated list to lead with
}

interface SpecConfirmationStep extends BaseStep {
  // car_rental: SpecConfirmation
  auto_fill_from: string;          // master source to read
  spec_fields: string[];           // which columns to surface as confirmable specs
  variant_selector?: boolean;      // also pick a variant from master row's variants?
}

interface PricingStep extends BaseStep {
  // car_rental: CarPricingForm
  price_fields: PriceField[];
  service_toggles_source?: string; // dotted path on master row (e.g. "master_vehicles.services_json")
  default_services?: string[];     // fallback if master row has none
  photo_slots?: string[];          // labelled photo upload slots ("Front", "Rear", ...)
}

interface PriceField {
  key: string;                     // form-state key ("day_rate")
  label: string;
  unit: string;                    // "₹", "₹/km", "/hr"
  required: boolean;
  default?: number;
  /**
   * Pull market benchmarks from a master-catalogue row. Renderer shows the
   * brand a min–max range bar so they price competitively.
   */
  benchmark_source?: string;       // "master_vehicles"
  benchmark_fields?: [string, string]; // ["day_rate_min", "day_rate_max"]
}

interface RepeatableItemStep extends BaseStep {
  // not used by car_rental but needed for restaurant menu, salon services
  // the renderer shows an "add another" pattern for arbitrarily many items
  item_fields: FieldDef[];
  min_items?: number;
  max_items?: number;
}

interface PhotoUploadStep extends BaseStep {
  slots?: string[];                // named slots OR
  min_photos?: number;             // freeform with minimum
  max_photos?: number;
  recommended_photos?: number;     // shown as guidance
}

interface PreviewStep extends BaseStep {
  // shows LivePreview + QualityScore + Publish CTA
  show_quality_score: boolean;
  show_live_preview: boolean;
}

interface DoneStep extends BaseStep {
  // car_rental's "Your vehicle is live!" celebration step
  boost_tips?: string[];           // e.g. "Add 3 more photos to reach Standard ranking"
}

// ── Field definitions (used by generic step + RepeatableItemStep) ───────────

export type FieldDef = {
  key: string;
  label: string;
  type:
    | "text"
    | "number"
    | "textarea"
    | "select"
    | "url"
    | "veg_toggle"
    | "duration_select"
    | "variant_builder"
    | "availability_picker";
  required: boolean;
  placeholder?: string;
  options?: string[];              // for type="select"
  default?: string | number | boolean;
};

// ── How wizard state writes to brand_products ───────────────────────────────

export interface ProductStorageConfig {
  enabled: boolean;
  required: boolean;
  excel_upload: boolean;
  master_catalogue: boolean;
  /**
   * Dotted-path map. Left side = column name in brand_products (or a key
   * inside variants_json). Right side = source — either "wizardState.foo"
   * or "master_row.foo" (dotted into the master row picked in
   * MasterPickerStep).
   *
   * Today's car_rental.json uses an ad-hoc shape; this contract formalizes it.
   */
  storage_format: Record<string, string | StorageNestedSpec>;
  fields: FieldDef[];              // overrides for individual columns
  excel_columns: ExcelColumnDef[];
}

interface StorageNestedSpec {
  // for typed JSON sub-objects (e.g. variants_json.specs)
  [key: string]: "string" | "number" | "boolean" | "string[]" | StorageNestedSpec;
}

interface ExcelColumnDef {
  column: string;                  // header in the .xlsx template
  field: string;                   // brand_products column it maps to
  required: boolean;
  example?: string;
}

// ── Quality scoring ─────────────────────────────────────────────────────────

export type QualityRule =
  | { field: string; points: number; label: string }                    // brand profile field present
  | { items: string; min: number; points: number; label: string }       // N items of `items` exist
  | { type: "photos"; min: number; points: number; label: string };     // photo count threshold

// ── Misc enums ──────────────────────────────────────────────────────────────

export type AvailingMode = "pay_at_store" | "online_order" | "prebook" | "enquiry";
export type BookingType  = "table" | "appointment" | "date_range" | "slot" | "package";
```

### Plain-language explanation

A `ListingTemplate` is the schema-driven contract for **how a business authors a listing on brand-web**. Every category lives as a JSON file in `backend/public/schemas/`. The schema declares a sequence of wizard steps, the per-item field definitions, the master catalogue dependency (if any), the storage mapping into `brand_products`, the buyer-side display hints, and the quality-scoring rules.

Implementers must satisfy the following:

- Every step in `listing_steps` declares a `component`. The renderer is responsible for mapping that name to either a built-in step component or a custom React component the template package ships. **The schema must not encode UI strings beyond labels/subtitles** — colors, fonts, and layout belong in the renderer.
- Wizard state submitted via `Publish` must produce a row that satisfies `product_config.storage_format`. Custom templates may bypass `fields[]` but must still map their state into `brand_products` columns through `storage_format`.
- `card_config` and `buyer_config` (defined under BuyerCard) must be present so the follower app has enough hints to render this listing without category-specific code paths.

Within the contract, implementers are free to:

- Add custom step types not in the union above, **provided** they register a renderer in brand-web and document the schema shape in this file.
- Choose not to use a master catalogue (set `features.master_catalogue: false`, omit `MasterPickerStep`).
- Use an arbitrary number of steps; the wizard chrome (progress bar, back/next, publish) is shared.

### Mapping to car_rental

| Contract field | car_rental fulfilment |
|---|---|
| `category_key`, `label`, `icon`, `super_category`, `phase`, `status` | `car_rental.json:2-7, 91-93` |
| `product_noun` / `_plural` | `"Vehicle"` / `"Fleet"` (`:5-6`) |
| `features.master_catalogue: true` | `:16` |
| `sections` | `:18-25` (Hatchback, Sedan, SUV, …) |
| `availing_modes` | `["prebook"]` (`:27-29`) |
| `booking_type` | `"date_range"` (`:26`) |
| `listing_steps[0]` (OptionGridStep) | `:118-162` schema → [VehicleTypeSelector.js](Packages/brand-web/app/dashboard/products/components/car-rental/VehicleTypeSelector.js) |
| `listing_steps[1]` (MasterPickerStep) `master_source: "master_vehicles", filter_by: "segment"` | `:163-180` → [MakeModelPicker.js](Packages/brand-web/app/dashboard/products/components/car-rental/MakeModelPicker.js) (consumes `/brands/me/master-catalogue`) |
| `listing_steps[2]` (SpecConfirmationStep) `auto_fill_from: "master_vehicles", spec_fields, variant_selector` | `:181-197` → [SpecConfirmation.js](Packages/brand-web/app/dashboard/products/components/car-rental/SpecConfirmation.js) |
| `listing_steps[3]` (PricingStep) with `price_fields, service_toggles_source, photo_slots` | `:198-258` → [CarPricingForm.js](Packages/brand-web/app/dashboard/products/components/car-rental/CarPricingForm.js) |
| `listing_steps[4]` (DoneStep) with `boost_tips` | `:259-269` → inline render in [CarRentalWizard.js:362-391](Packages/brand-web/app/dashboard/products/components/car-rental/CarRentalWizard.js) |
| `product_config.storage_format` | `:271-300` schema; **actually executed in code** at [CarRentalWizard.js:85-103](Packages/brand-web/app/dashboard/products/components/car-rental/CarRentalWizard.js) (`handlePublish` builds the payload by hand — declarative mapping is currently *documentation only*) |
| `quality_rules` | `:434-483` |

### Gaps and ambiguities

1. **`product_config.storage_format` is documentation, not code.** car_rental's schema declares the mapping but `CarRentalWizard.handlePublish()` constructs the payload imperatively. Either we make the renderer drive the payload from the schema, or we drop `storage_format` from the schema. The first is correct — required for new templates to be configuration-driven.
2. **Wizard chrome (3 views: fleet / add / upload) is hand-rolled in `CarRentalWizard.js`.** Tabs, Excel-upload UI, fleet list rendering, "Remove" action — none of this is in the contract. Every future template will need the same chrome. Should be promoted to a shared `<TemplateLayout>` so templates only ship the per-step components.
3. **Photo upload is visually scaffolded in `CarPricingForm.js:127-147` but does not actually upload anything** — the file picker is decorative; no R2 call. Treat all `photo_slots` / `min_photos` as **not yet implemented** at runtime.
4. **Master-catalogue contract is loose.** The schema says `master_source: "master_vehicles"` but the wizard reads from `/brands/me/master-catalogue` (a single endpoint that the backend dispatches to the right master). The contract needs to formalize this endpoint shape so salon (`master_services`), restaurant (`master_dishes`), etc., can plug in.
5. **Hardcoded UI assets in components.** `MakeModelPicker.js:31-49` has a hardcoded `MAKE_LABELS` map (country, abbreviation). `VehicleTypeSelector.js:8-57` has hardcoded SVGs per icon key. The contract assumes the schema is the source of truth; either the schema needs to carry these labels/icons (heavy) or the renderer needs an icon-pack registry.
6. **Validation is per-step `canProceed()` in component code** ([CarRentalWizard.js:74-80](Packages/brand-web/app/dashboard/products/components/car-rental/CarRentalWizard.js)), not declared in the schema. Restaurant and salon will have different per-step validity rules. Either each step component owns its `isValid()` (current pattern) or the schema declares required fields per step.
7. **No `RepeatableItemStep` exists in any current template** — but restaurant menu and salon services are exactly this shape. Flagged for v1.

---

## 2. BuyerCard Contract

### Interface (TypeScript)

```ts
/**
 * A BuyerCard is the compact representation of a single listing item shown
 * to a follower in discovery surfaces (feed, store, search, category list).
 *
 * Every category-specific card (CarRentalCard today; restaurant/salon/etc.
 * tomorrow) must expose the same outward props so a single discovery feed
 * can render heterogeneous items.
 */
export interface BuyerCardProps {
  // ── Identity / hero ───────────────────────────────────────────────────────
  item: BuyerItem;                 // the underlying product/service row
  template: TemplateBuyerHints;    // pulled from schema at render time

  // ── Optional influencer attribution layer ─────────────────────────────────
  /**
   * Present when the follower arrived via an influencer's tracking link.
   * The card overlays the discount badge + bottom strip on the hero.
   */
  attribution?: {
    influencer_name: string;
    influencer_handle: string;
    influencer_initial: string;
    influencer_color: string;      // CSS color for avatar background
    discount_value: number;        // 10 means 10% (or absolute ₹ if discount_unit="abs")
    discount_unit?: "pct" | "abs";
    discount_label: string;        // e.g. "10% OFF" — pre-formatted
  };

  // ── Interactions ──────────────────────────────────────────────────────────
  onPress: () => void;             // tapping the card opens BuyerDetail
  onPressPrimary: () => void;      // primary CTA (e.g. "Pre-book")
  onPressSecondary?: () => void;   // optional secondary CTA (e.g. "At Garage")
  onPressSave?: () => void;        // heart / save icon
}

export interface BuyerItem {
  id: string;
  name: string;                    // primary title ("Toyota Innova")
  /**
   * Subtitle data lives here as a flat object. The template's
   * `subtitle_template` (e.g. "{year} · {variant} · {fuel_type}") interpolates
   * from this. Keys present depend on the category — that's fine, the
   * template renderer tolerates missing keys.
   */
  subtitle_data: Record<string, string | number | boolean | undefined>;

  cover?: {                        // hero image / asset
    image_url?: string;            // if missing, renderer falls back to icon
    icon: string;                  // emoji / icon key
    accent_bg?: string;            // background colour (template default if absent)
  };

  // Pricing
  price: {
    amount: number;                // primary price (e.g. day_rate)
    original_amount?: number;      // for MRP strikethrough
    per_unit_label: string;        // "per day (24 hrs)", "per plate"
  };

  // Discovery metadata
  location?: { name: string; distance_text?: string };
  rating?: { value: number; review_count?: number };

  // Availability / status
  available?: boolean;             // shows green dot + "Available"

  // Specs / attributes — the source of card tags & detail-page spec_grid
  attributes: Record<string, string | number | boolean | string[] | undefined>;
  // e.g. { seats: 7, fuel_type: "Diesel", transmission: "Automatic", sunroof: true,
  //        features: ["GPS","Bluetooth"], services: ["With driver","Outstation"] }
}

/**
 * The schema-driven hints that tell the card *how* to render a generic
 * BuyerItem. Pulled from the template's card_config.
 */
export interface TemplateBuyerHints {
  accent: string;                  // hex (e.g. "#f59e0b")
  accent_dim: string;              // rgba (e.g. "rgba(245,158,11,0.1)")
  icon: string;                    // emoji fallback for cover
  card_type: string;               // semantic key — "vehicle" | "menu_item" | "service" | "package"

  cta_primary:   { label: string; action: BuyerAction; color?: string };
  cta_secondary?: { label: string; action: BuyerAction };

  price_display: {
    source: string;                // attribute key OR "price.amount"
    unit: string;                  // "/day", "/plate"
  };

  subtitle_template: string;       // e.g. "{year} · {variant} · {fuel_type}"

  /**
   * Tag rules driving the spec chips on the card. Renderer evaluates each
   * rule against the item's `attributes` and renders qualifying tags.
   */
  tags: TagRule[];
}

export interface TagRule {
  source: string;                  // dotted path into BuyerItem.attributes
  format?: string;                 // template like "{value} seats"
  text?: string;                   // override (used with show_if for booleans)
  show_if?: boolean | string;      // condition to show
  highlight_if?: string;           // expression e.g. "value >= 7"
  highlight?: boolean;             // unconditional highlight
  use_first?: boolean;             // for split-fields like "Auto / Manual" → "Auto"
  show_first?: number;             // for arrays — show only first N
}

export type BuyerAction =
  | "book_slot"        // opens BuyerDetail's slot/date picker action flow
  | "walkin_pay"       // opens PayAtStoreScreen
  | "online_order"     // opens cart/order flow
  | "enquiry"          // opens enquiry form
  | "external_link";   // opens browser
```

### Plain-language explanation

A `BuyerCard` is the **uniform discovery surface** for any listing, regardless of what category it came from. The contract has two halves: a category-agnostic `BuyerItem` (what the follower sees) and a `TemplateBuyerHints` block (how the schema customises rendering — colors, tag rules, CTA labels). Together they let a single feed render a vehicle card, a menu-item card, and a wedding-package card without if-by-category logic.

Every implementer must:

- Render the **influencer attribution layer** when `attribution` is present (badge top-left, strip bottom, modified primary-CTA price).
- Honor `cta_primary.action` and `cta_secondary?.action` — these map to follower-side action flows shared across templates (slot booking, walk-in pay, online order, enquiry).
- Read `subtitle_data` and `attributes` as dictionaries — never assume specific keys at the card level. The template's `subtitle_template` and `tags[]` decide what's surfaced.

Implementers may:

- Style the cover area distinctively (vehicle SVG, food photo, salon photo grid). The contract only requires that it occupies a hero region.
- Add card-type-specific micro-elements (e.g. "Available" pill, rating, trip count) but only if surfaced through standard `BuyerItem` fields.

### Mapping to car_rental

| Contract field | car_rental implementation |
|---|---|
| `BuyerItem.name`, `subtitle_data` | `vehicle.name`, `{ year, variant }` ([CarRentalCard.js:65-69](Packages/Mobile/src/components/cards/CarRentalCard.js)) |
| `attribution.*` | `discount.influencer_name / _initial / _color / value` (`:51-59`) |
| `BuyerItem.cover` (icon fallback) | hardcoded `🚗` emoji on `#0A1D3E` ground (`:33-37`) |
| `price.amount`, `original_amount`, `per_unit_label` | `pricing.day_rate / original_rate / per_unit` (`:97-106`) |
| `location` | `vehicle.location + distance` (`:91-94`) |
| `rating` | `vehicle.rating + trips` (`:74-78`) |
| `available` | hardcoded `Available` badge (`:71-74`) — **not yet driven by data** |
| `attributes.seats / fuel_type / transmission / sunroof / features` | `vehicle.specs.*` (`:21-29`) |
| `TemplateBuyerHints.accent / accent_dim / icon / card_type` | `card_config.accent / accent_dim / icon / card_type` (`car_rental.json:302-305`) |
| `cta_primary` / `cta_secondary` | `card_config.cta_primary / cta_secondary` (`car_rental.json:306-314`) — but **CarRentalCard hardcodes "Book Now" / "At Garage"** instead of reading the schema |
| `subtitle_template` | `card_config.subtitle_template` (`:319`) — **not consumed by CarRentalCard**; subtitle is built ad hoc |
| `tags[]` rules | `card_config.tags` (`:320-348`) — **partially consumed**; CarRentalCard has its own TagRule-equivalent logic in JS |

### Gaps and ambiguities

1. **CarRentalCard does not consume `card_config` from the schema.** The schema defines tags / cta labels / subtitle template, but the React Native card has these baked in. To honor the contract, the renderer must read `template.card_config` and drive itself from it. This is the single biggest change required.
2. **Influencer attribution shape is implicit.** `discount.value` is treated as percent in code. The contract adds `discount_unit: "pct" | "abs"` and a pre-formatted `discount_label`, because absolute-rupee influencer offers will exist (e.g. ₹100 off a ₹500 plate).
3. **`available` is currently hardcoded.** No schema field, no item-level field, just a literal "Available" pill. Real availability needs a flag on `brand_products` (today's `availability_json` exists but is not surfaced).
4. **No standard cover-image flow.** Vehicle uses an emoji because no photos upload yet; restaurant/salon will need a real image with placeholder fallback. The cover sub-shape needs to be promoted to a real concern.
5. **`card_type` enum is loose.** Today it's "vehicle"; we need to enumerate the small set ("vehicle" | "menu_item" | "service" | "package" | "product" | "vendor_portfolio") so renderer dispatch is predictable.
6. **`onPressSave` is non-functional today.** The heart icon in `CarRentalCard.js:46-49` is decorative. Fine for v0 contract, flag for v1.

---

## 3. BuyerDetail Contract

### Interface (TypeScript)

```ts
/**
 * BuyerDetail is the full-screen page that follows a card tap. It renders
 * the listing's hero, structured detail sections (specs, features, pricing
 * tabs, pickup options, etc.), the influencer attribution strip, and one or
 * two sticky CTAs that initiate an ActionFlow.
 *
 * Sections are declared in the template's card_config.detail_sections so
 * different categories can compose detail pages from a small library of
 * section types.
 */
export interface BuyerDetailProps {
  item: BuyerItem;                 // same shape as BuyerCard
  template: TemplateDetailHints;
  attribution?: BuyerCardProps["attribution"];
  tracking?: TrackingContext;      // campaign/set/offer/influencer ids inherited from share link

  // The follower app navigates here from the card; primary/secondary actions
  // continue into the booking/ordering/enquiry flows.
  onActionPrimary: (action: BuyerAction, ctx: ActionContext) => void;
  onActionSecondary?: (action: BuyerAction, ctx: ActionContext) => void;
  onShare?: () => void;
  onSave?: () => void;
  onGetDirections?: (lat: number, lng: number, label: string) => void;
}

export interface TemplateDetailHints extends TemplateBuyerHints {
  detail_sections: DetailSection[];
  booking_config: BookingConfig;   // declares the ActionFlow shape for primary CTA
}

// ── Detail section primitives ───────────────────────────────────────────────

export type DetailSection =
  | SpecGridSection
  | FeatureChipsSection
  | PricingTabsSection
  | PickupOptionsSection
  | GallerySection            // not used by car_rental yet — needed for restaurant/salon
  | RepeatableListSection     // for menu items, service lists
  | DescriptionSection        // long-form rich text
  | ContactSection;           // call / WhatsApp / map

interface SpecGridSection {
  type: "spec_grid";
  title: string;
  fields: string[];                // attribute keys to surface
  emphasized_field?: { key: string; color: "green" | "amber" | "red" };
  // car_rental uses 'Insurance' as a green emphasized field for trust signal
}

interface FeatureChipsSection {
  type: "feature_chips";
  title: string;
  source: string;                  // attribute key — must be string[]
}

interface PricingTabsSection {
  type: "pricing_tabs";
  title: string;
  tabs: PricingTab[];
}

interface PricingTab {
  key: string;                     // "with_driver" | "self_drive" | "outstation"
  label: string;
  fields: string[];                // attribute keys whose values are shown as rows
  /**
   * Optional formula declaration so the tab can compute derived values
   * (e.g. self_drive = day_rate * 0.67). Today CarDetailScreen hardcodes
   * these multipliers — to be configuration-driven, we need a formula DSL.
   * Out of scope for v0.
   */
  derived?: Record<string, string>;
}

interface PickupOptionsSection {
  type: "pickup_options";
  title: string;
  options: Array<{ key: string; label: string; sub: string; extra_charge?: number }>;
}

interface GallerySection {
  type: "gallery";
  title?: string;
  source: string;                  // path to image array (e.g. "photos")
  layout: "carousel" | "grid";
}

interface RepeatableListSection {
  type: "repeatable_list";
  title: string;
  source: string;                  // path to array (e.g. "menu_items", "services")
  item_template: "menu_row" | "service_row" | "package_card";
}

interface DescriptionSection {
  type: "description";
  title?: string;
  source: string;                  // path to text
}

interface ContactSection {
  type: "contact";
  show: Array<"call" | "whatsapp" | "directions" | "share">;
}

// ── Action flow (the screen that follows the primary CTA) ───────────────────

export interface BookingConfig {
  type: BookingType;               // "table" | "appointment" | "date_range" | "slot" | "package"
  fields: string[];                // input fields the booking flow collects
  /**
   * Token vs full payment. Token-only locks slot, balance paid at venue.
   * Full pays end-to-end. Both are also possible (offer both buttons).
   */
  payment_modes: ("token" | "full")[];
  token_amount?: number;           // ₹ — required if "token" in payment_modes
  token_refundable?: boolean;
  refund_policy?: string;          // human-readable
  balance_text?: string;           // shown next to balance line
}

export interface ActionContext {
  // What the follower's ActionFlow needs to start the booking on the backend.
  tracking?: TrackingContext;
  selected_options?: Record<string, unknown>;  // e.g. { pickupType: "doorstep" }
  payment_mode?: "token" | "full";
}

export interface TrackingContext {
  // Inherited from the share-link query params on InfluencerStoreScreen entry.
  campaign_id?: string;
  set_id?: string;
  offer_id?: string;
  campaign_influencer_id?: string;
}
```

### Plain-language explanation

A `BuyerDetail` is the full-screen view that follows a card tap. The page is composed from a **small library of section primitives** declared in the template's `detail_sections`. The renderer walks the list and emits the matching React Native component for each section. The page also has a sticky CTA region that initiates an `ActionFlow` — for car_rental that's date/duration → token Razorpay payment → confirmation; for restaurant it would be table-time slot → guest count → token payment.

Every implementer must:

- Render every section type listed under `DetailSection`. New section types can be added to the union but must be implemented in the renderer in the same commit.
- Honor `booking_config.payment_modes` — if both `token` and `full` are present, render both CTAs (as car_rental does today).
- Pass the `TrackingContext` through to the backend booking call so commission attribution works (this is non-negotiable — the platform's revenue model depends on it).

Implementers may:

- Choose section ordering — `detail_sections` is a sequence and the renderer respects it.
- Add per-template chrome (e.g. CarDetailScreen's gradient hero, restaurant's veg-filter pill) **above** the sections, not inside them.

### Mapping to car_rental

| Contract field | car_rental implementation |
|---|---|
| `item`, `template`, `attribution`, `tracking` | `route.params` ([CarDetailScreen.js:21](Packages/Mobile/src/screens/follower/CarDetailScreen.js)) |
| `SpecGridSection` with `Insurance` as emphasized green field | `card_config.detail_sections[0]` (`car_rental.json:349-361`) → spec grid (`CarDetailScreen.js:124-139`) |
| `FeatureChipsSection` source `specs.features` | `car_rental.json:362-365` → horizontal feature row (`CarDetailScreen.js:142-149`) |
| `PricingTabsSection` with three tabs | `car_rental.json:366-401` → tabBar + tabData (`CarDetailScreen.js:14-18, 31-68, 152-178`) |
| `PickupOptionsSection` (garage / doorstep) | `car_rental.json:404-417` → pickupRow (`CarDetailScreen.js:181-193`) |
| `BookingConfig` type=date_range, fields, token_amount=300, refund_policy | `card_config.booking_config` (`car_rental.json:420-432`) |
| `payment_modes: ["token", "full"]` (two CTAs) | `car_rental.json` declares only `token`; CarDetailScreen actually shows BOTH "Book full" and "Pre-book token" CTAs (`CarDetailScreen.js:217-236`) — schema/code mismatch |
| `onActionPrimary` flow → CarBookingScreen | passes `bookingType: 'token' \| 'full'` (`:219, 228`) |
| `CarBookingScreen` itself implements the ActionFlow: dates, duration, pickup, breakdown, Razorpay → backend prebook + verify | [CarBookingScreen.js:33-106](Packages/Mobile/src/screens/follower/CarBookingScreen.js) |
| `tracking` plumbed through to `followerApi.prebook(...)` | `CarBookingScreen.js:51-60` |

### Gaps and ambiguities

1. **`PricingTabsSection.derived` is not yet defined.** `CarDetailScreen.js:46-67` hardcodes `Math.round(dayRate * 0.67)` for self-drive and other multipliers. A formula DSL or per-template hook is needed before another category uses pricing tabs.
2. **`emphasized_field` is implicit.** `CarDetailScreen.js:131-133` hardcodes `Insurance: 'Covered'` as the green spec. Schema doesn't carry this — must be promoted.
3. **Schema `payment_mode` is singular ("token") but the UI shows both token and full** ([CarDetailScreen.js:218-235](Packages/Mobile/src/screens/follower/CarDetailScreen.js)). Either drop the full-pay button or extend the schema to `payment_modes: ["token", "full"]` (the contract above takes the latter direction).
4. **`CarBookingScreen` reuses `followerApi.prebook` whose backend payload is restaurant-shaped** (booking_date, booking_time, guest_count, notes). The car booking is being shoehorned into the table-booking endpoint — `notes` carries the duration & pickup info as a string. This works but breaks the contract's promise that `BookingConfig.type` drives the request shape. Need either:
   - Per-booking-type endpoints (`/follower/prebook-table`, `/follower/prebook-slot`, `/follower/prebook-daterange`), OR
   - A polymorphic body on the existing endpoint, with `booking_type` and a typed `details` object.
5. **No `GallerySection` implementation today** because the cover is an emoji. Restaurant menu items, salon work-portfolio, and wedding photos all need this. Flagged for restaurant build.
6. **No `RepeatableListSection`.** The menu of a restaurant is a list of items rendered inside the brand store, not on a single product detail. Restaurant might invert the model: the *store* is the detail page; an "item" detail is a smaller modal. Worth designing carefully — see Question 5 below.
7. **`ContactSection` is partially implemented.** `BrandStoreScreen.js` has Call / WhatsApp / Map buttons; on `CarDetailScreen` only "Get Directions" is conditional on `brand_lat/brand_lng`. The contract should standardise this.
8. **`available` flag from BuyerItem isn't surfaced on the detail page.** If a vehicle is currently rented out, the detail page should reflect that. Not in v0 scope but flag as Phase 2 work.

---

## 4. Recommended contract adjustments

These are based on what I expect restaurant + salon will need that car_rental does not exercise:

1. **Add `RepeatableItemStep` to ListingTemplate** — restaurant menu and salon services are arbitrarily-many-item authoring flows. car_rental gets one item per wizard run; restaurant onboards 50+ items in one flow.
2. **Promote `storage_format` to be code-driven, not documentation.** Custom templates today (i.e. car_rental) build the payload imperatively. As soon as we add restaurant we'll have the same imperative code in two places. Move payload assembly into the renderer, driven by `storage_format`.
3. **Add a `GallerySection` and a real photo upload pipeline.** Vehicle survives on emoji + future photos; restaurant cannot. Recommend wiring `R2_UPLOAD` first and treating photo upload as a shared concern outside the template contract — every template gets it.
4. **Make `card_config` actually drive the card.** Today the schema's `card_config` is largely ignored by the React Native card. The first refactor under this contract should be: rewrite `CarRentalCard.js` to read from `template.card_config` instead of carrying its own subtitle/tag/cta logic. Do this *before* writing `RestaurantCard.js`, so RestaurantCard can be much smaller (just the cover treatment).
5. **Formalize the master-catalogue endpoint contract.** Today there's one `/brands/me/master-catalogue` returning vehicles. Restaurant doesn't need a master, but salon does (master_services). Recommend `GET /brands/me/master-catalogue?source={master_vehicles|master_services|master_dishes}` returning `{items: [...]}` where each item has at minimum `id`, `display_name`, plus arbitrary template-specific keys.
6. **Enumerate `card_type` and `BookingType`.** Loose strings make renderer dispatch fragile. The unions in this doc are a starting point; lock them at v1.
7. **Add `booking_config.endpoint` so each booking type can call the right backend route.** Avoids the current "stuff cars into the prebook-table endpoint" hack.
8. **Move wizard chrome (fleet view, bulk-upload tab, progress bar, back/next, publish) out of CarRentalWizard into a shared `<ListingTemplateLayout>`.** Templates ship only their step components.

---

## 5. Questions for Chat (decisions needed before locking)

1. **Restaurant model question** — is a restaurant *one listing* (the restaurant) with menu items as a section inside its detail page, or is each menu item its own listing with its own detail page? car_rental treats each *vehicle* as its own listing because vehicles are rentable individually. For a restaurant the analogous primitive could be the *restaurant* (browse menu inside) or the *menu item* (book a table for this dish). Pick one — it changes whether restaurant uses `RepeatableListSection` inside a single detail page (one listing) or `RepeatableItemStep` in the wizard with N detail pages (many listings). My recommendation: **the restaurant is the listing**; menu items are a section inside its detail page. The salon would follow the same pattern (salon = listing, services = section). Wedding venues likewise.

2. **Are tag/cta/subtitle hints in `card_config` *prescriptive* or *advisory*?** I.e. does CarRentalCard MUST consume them (contract), or MAY override them (template freedom)? My recommendation: **prescriptive for the tag rules and CTA labels** (so chat can iterate on copy without code changes), **advisory for visual treatment** (cover, layout). Confirm.

3. **Photo upload — per-template configuration or platform-wide?** car_rental's schema has named slots (`Front`, `Rear`, `Interior`, `Dashboard`); restaurant probably wants an unbounded grid; wedding wants 10+ photos with portfolio sections. I recommend treating *upload mechanics* as platform-wide (single R2 wrapper, shared UI component) but *requirements* (slot names / min count / aspect ratios) as per-template via `PhotoUploadStep`.

4. **Booking endpoint strategy** — extend the existing `/follower/prebook` to be polymorphic on `booking_type`, OR ship dedicated routes per booking type? Polymorphic is faster but tests get messier; dedicated routes are cleaner but multiplies the endpoint count by booking_type. I lean polymorphic with a typed `details` payload, but want chat's call.

5. **Where does the "store as the listing" decision live?** Today brand-web treats every brand as having a single business profile + many products. If we go with "restaurant = listing", do we make the brand profile itself a "listing", and `brand_products` becomes the menu items (which already maps cleanly)? Confirm so I can scope the data-model implications.

6. **Action types — locked enum or extensible?** I'd lock to `book_slot | walkin_pay | online_order | enquiry | external_link` for v1. Adding a new one would require a new BuyerAction handler app-wide. Restaurant + salon + wedding all map to existing four; nothing else is on the roadmap that needs a new one. Confirm.

7. **`CardType` short list** — does `vehicle | menu_item | service | package | product | vendor_portfolio` cover the 13 clusters, or do you want me to enumerate more aggressively against your cluster list?

8. **Should `card_config.detail_sections` ordering be fixed-by-contract** (e.g. spec_grid always before pricing_tabs) or fully template-controlled? I lean template-controlled; chat may have UX reasons to reorder per category.

---

## 6. Files examined (full list)

**Schema**
- [backend/public/schemas/car_rental.json](backend/public/schemas/car_rental.json) — 484 lines; the only schema with detail_sections, pricing_tabs, master_catalogue + listing_steps + booking_config all defined

**Brand-web wizard**
- [Packages/brand-web/app/dashboard/products/components/car-rental/CarRentalWizard.js](Packages/brand-web/app/dashboard/products/components/car-rental/CarRentalWizard.js) — 5-step wizard orchestrator + fleet view + bulk upload
- [Packages/brand-web/app/dashboard/products/components/car-rental/VehicleTypeSelector.js](Packages/brand-web/app/dashboard/products/components/car-rental/VehicleTypeSelector.js) — step 1 (OptionGridStep)
- [Packages/brand-web/app/dashboard/products/components/car-rental/MakeModelPicker.js](Packages/brand-web/app/dashboard/products/components/car-rental/MakeModelPicker.js) — step 2 (MasterPickerStep)
- [Packages/brand-web/app/dashboard/products/components/car-rental/SpecConfirmation.js](Packages/brand-web/app/dashboard/products/components/car-rental/SpecConfirmation.js) — step 3 (SpecConfirmationStep)
- [Packages/brand-web/app/dashboard/products/components/car-rental/CarPricingForm.js](Packages/brand-web/app/dashboard/products/components/car-rental/CarPricingForm.js) — step 4 (PricingStep) with benchmarks + service toggles + photo slots

**Follower app — discovery card**
- [Packages/Mobile/src/components/cards/CarRentalCard.js](Packages/Mobile/src/components/cards/CarRentalCard.js) — discovery card with attribution overlay, spec tags, dual CTA

**Follower app — detail page**
- [Packages/Mobile/src/screens/follower/CarDetailScreen.js](Packages/Mobile/src/screens/follower/CarDetailScreen.js) — hero, spec_grid, feature_chips, pricing_tabs, pickup_options, sticky CTAs

**Follower app — action flow**
- [Packages/Mobile/src/screens/follower/CarBookingScreen.js](Packages/Mobile/src/screens/follower/CarBookingScreen.js) — date/duration picker, pickup type, price breakdown, Razorpay token payment, prebook+verify

**Not examined in this pass (mentioned, but contract-orthogonal):**
- Backend `brand.controller.js`, `listing.service.js`, `excel.service.js` — relevant to ProductStorageConfig and the master-catalogue endpoint shape
- `BrandStoreScreen.js`, `HomeScreenV2.js`, `InfluencerStoreScreen.js` — where BuyerCard surfaces appear (relevant to TrackingContext provenance)

These should be examined in a follow-up pass if we lock the contract questions in §5 and want to formalize the backend API shape too.
