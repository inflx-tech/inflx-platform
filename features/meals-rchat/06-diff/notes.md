# meals-rchat — before/after notes

**Mockup baseline (before):** `04-preview/mockups/01-restaurant-offer-setup.html`
includes a "Create your own offer type" card with a plain-English textarea
and a "Build this rule" button. P2 shipped the static form version;
this phase wires the **AI chat brain** behind that box.

**Implementation (after):**
- The Setup tab's create-your-own card is now a chat: textarea →
  *Build with chat* → backend calls `extractRestaurantOffer`, joins
  menu prices, and inserts the rule as `status='suggested'`.
- The chat thread renders inline: bot clarifies on missing party_size
  / items, or confirms with a "Built …" line and the offer appears in
  the AI-suggested section above (where Accept / Modify / Reject
  lives — the lifecycle from P2 + P-AI-INTEL).

## What matches the mockup
- Plain-English description → structured offer rule.
- Items pulled from the real menu; freebies + discount preserved
  from the owner's words.
- Lifecycle queue identical to AI-suggested rules.

## What diverged (intentional, this phase)
- The mockup hinted at a photo URL field in this box — kept that out
  of P-RCHAT to focus the chat on combination + price logic; photos
  remain on the Modify path of the OfferCard (P2).
- Multi-turn refinement ("change qty to 3") is single-shot for now;
  the orchestrator already accepts `partial_offer` so a follow-up
  message can refine without re-typing the whole description.

## What to check manually
- Type *"chicken biryani with free raita, 10% off"* → bot clarifies
  party_size.
- Type *"family pack with 2 chicken biryani and 2 veg biryani, ₹90
  off, free raita"* → "Built Family Pack (family, base ₹1,040, ₹90
  off, free Raita)" → suggested card appears above with Accept.
- Type *"duo combo for 2 with 1 chicken biryani and 1 veg biryani,
  ₹50 off, if raining, within 3 km"* → `offer_kind='custom'`,
  `trigger_json={weather:'rain', max_km:3}`.
