# meals-ai-suggest — before/after notes

**Mockup baseline (before):** `04-preview/mockups/01-restaurant-offer-setup.html`
shows the AI co-pilot with 24-style suggested cards + Accept/Modify/Reject
+ rough margin hint + modify-by-chat + learning note + editable discount
clock + create-your-own + photo upload. P2 already delivered the
lifecycle UI; this phase wires the **AI source** that fills it.

**Implementation (after):**
- Brand-web Setup tab gains an **"✨ AI offer suggestions"** banner.
  Button: *"✨ Generate AI suggestions"* → calls `mealsApi.suggestOffers`
  → suggested cards land above the party-size grid; the existing
  OfferCard renders Accept/Modify/Reject and the lifecycle from P2.
- Backend joins `brand_products.price` for each AI-referenced item;
  AI never touches money. Mock mode produces 5 deterministic combos
  from the menu; live mode (Anthropic key + `AI_MOCK=false`) calls
  Claude Sonnet with `tool_choice = emit_offers`.

## What matches the mockup
- The AI feed exists and renders Accept/Modify/Reject as cards.
- Items + freebies + suggested name + reasoning, all real.

## What diverged (intentional, this phase)
- "Rough margin to you" hint is not surfaced yet — the cost-floor
  side of `meal_restaurant_learnings` is empty until **P6**
  (learning-loop writes); the hint becomes real once the owner has
  confirmed any costs/floors.
- "Modify by chat" is **P-RCHAT** (next).

## What to check manually
- A restaurant with a menu of 4+ items → "✨ Generate AI suggestions"
  → 3–5 cards across party sizes appear → Accept one → it leaves
  the AI list and shows under the party-size tab as `active`.
