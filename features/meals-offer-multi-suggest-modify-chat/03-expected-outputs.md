# 03 — Expected outputs

## Backend (verified by `pnpm qa:db` — backend jest)

- `meal_offer_rules.recommended` exists (boolean, default false); existing rows = false. Idempotent re-apply = zero delta.
- `POST /meals/offer-rules/suggest` (menu present) → ≥1 `status='suggested'` `source='ai'` rows spanning multiple party sizes incl. `family`; each item price joined from `brand_products` (no zeros/nulls); `base_price = Σ price×qty`. At least one row may carry `recommended=true`. (Existing `meals-suggest.test.js` stays green: family present, ≥3 distinct sizes, prices joined, Accept→active.)
- `POST /meals/offer-rules/suggest` (empty menu) → 422 VALIDATION_ERROR (unchanged).
- `POST /meals/offer-rules/:id/modify-chat` → `{stage:'preview', proposed:{...priced...}, reasoning}` and persists nothing; vague msg → `{stage:'clarify', question}`; unknown id → 404.
- `GET /meals/menu-costs` → `{items:[{id,name,price,cost|null}]}`. `PUT /meals/menu-costs` `{brand_product_id,cost}` → upserts one cost learning; bad cost → 422; foreign product → 404.
- All non-meals backend suites unchanged (zero regression).

## brand-web (review + before/after diff)

- "Generate AI suggestions" yields several combos; `recommended` cards show ⭐ Best-pick; each AI card shows the advisory reasoning line.
- **Modify** opens a per-offer chat; preview card shows proposed items/freebies/price + **Apply**; after Apply the offer is updated and still `suggested`; Accept makes it live.
- Sidebar "Your dish costs (private)" lists menu items with an editable cost; save persists; never shown to customers.
