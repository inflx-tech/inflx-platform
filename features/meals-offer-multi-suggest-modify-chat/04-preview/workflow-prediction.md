# 04 — Workflow prediction

Predicted owner experience after this change (mockup: `mockups/meals-offers.html`):

1. Owner opens Meals → "Offers & setup". Sidebar now has **"Your dish costs (private)"**; owner confirms a few costs (saved silently to `meal_restaurant_learnings`).
2. Owner clicks **Generate AI suggestions** → backend calls live Claude with the menu + confirmed costs → **several** combos appear across party sizes; the strongest show a **⭐ Best pick** badge; each card shows a one-paragraph **advisory reasoning** (the loyalty rationale, e.g. cheap add-on → repeat customers).
3. Owner clicks **Modify** on a card → a **per-offer chat panel** opens above the grid. Owner types "add a free small coke + 3 chicken 65" → Claude returns a **preview** (updated items/freebies/price) with a one-line rationale. Nothing is saved yet.
4. Owner clicks **Apply** → the offer updates in place, still `suggested`. Owner clicks **Accept** on the card → it goes live. (Decline = Reject, unchanged.)

Predicted backend: `recommended` populated on suggested rows; modify-chat returns preview only (no write until Apply→PATCH); cost upsert writes one `learning_type='cost'` row per dish. No customer-facing change.

Edge predictions: empty menu → 422 ("add menu items first"); vague modify message → one clarify question; no Claude key → deterministic mock still produces multi-size combos + reasoning (degraded wording, same shape).
