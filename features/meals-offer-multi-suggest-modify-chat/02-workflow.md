# 02 — Workflow

## A. Generate multiple offers (owner clicks "Generate AI suggestions")

1. brand-web `POST /meals/offer-rules/suggest`.
2. `suggestOffersForBrand` loads active menu + owner-confirmed costs (`learning_type='cost'`) and attaches `cost` per menu item; loads learnings as memory.
3. `ai.suggestOffers({ menu, memory })` → live Claude (or deterministic mock fallback) returns an array of combos across party sizes, each with `party_size`, `offer_kind`, items (`product_id` refs), `freebies`, `recommended`, and owner-facing `reasoning` (loyalty rationale). Prices are NEVER set by AI.
4. Backend joins menu prices, computes `base_price`, inserts each as `meal_offer_rules` (`status='suggested'`, `source='ai'`, `recommended`, `custom_description=reasoning`).
5. brand-web renders cards: ⭐ Best-pick badge on `recommended`, advisory `reasoning` under each card, Accept / Modify / Reject.

## B. Modify an offer by chat (preview-then-accept)

1. Owner clicks **Modify** on a card → per-offer chat panel opens.
2. Owner types a change ("make it 10% cheaper", "add a free small coke", "swap chicken biryani for mutton biryani").
3. `POST /meals/offer-rules/:id/modify-chat` → `modifyOfferByChat` loads the offer + menu, calls `ai.modifyOffer(current, instruction, {menu})`.
4. AI returns the FULL updated offer; backend joins menu prices and returns a **preview** (nothing persisted). Vague instruction → `stage='clarify'` with one question.
5. Owner reviews the preview → clicks **Apply** → `PATCH /meals/offer-rules/:id` with the proposed fields (offer stays `status='suggested'`).
6. Owner clicks **Accept** on the card → `status='active'` (existing path). Nothing live changed until this step.

## C. Cost capture (sidebar)

1. brand-web `GET /meals/menu-costs` → active menu + owner-confirmed cost per item.
2. Owner enters a dish cost → `PUT /meals/menu-costs` `{brand_product_id, cost}` → upsert `meal_restaurant_learnings` (`learning_type='cost'`, `owner_confirmed=true`).
3. These costs flow into step A.2 so Claude's "won't cost you much" advice is grounded.
