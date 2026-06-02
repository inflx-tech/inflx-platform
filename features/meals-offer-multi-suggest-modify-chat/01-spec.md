# 01 — Spec: Meals offer multi-suggest + modify-by-chat + loyalty advisor

**Contract slug:** `meals-offer-multi-suggest-modify-chat`
**Area:** backend (migration + src) + brand-web. UI-governed.
**Status:** spec-lock delegated under standing autonomy (founder: "pls go and implement", 2026-06-02).

## Problem

The Meals AI offer-suggest worked but fell short of the founder's intent on three points (all confirmed against code 2026-06-02):

1. The suggest prompt emitted **one offer per party-size**, not a varied set of combinations — the owner could not get "multiple offers" and a best-pick.
2. The **Modify** button on every offer card was a **dead button** (no handler) — owners could not refine a suggestion.
3. Claude gave no **business-growth advice**. The founder wants Claude to act as a loyalty advisor: recommend low-cost, high-loyalty add-ons (e.g. "a small Coke + 3 small chicken-65 pieces — costs you little, builds repeat customers") and explain the rationale to the owner. For "won't cost you much" to be honest, Claude needs owner-confirmed item costs.

## Scope (locked decisions, 2026-06-02)

- **Multiple offers, best flagged** — "all sizes at once, best flagged". Claude generates several varied combos across all party sizes and marks the strongest 1–2 `recommended`.
- **Modify → per-offer chat**, "preview-then-accept". Clicking Modify opens a chat bound to that offer; Claude proposes a full updated offer; the owner reviews and clicks Apply (offer stays `suggested`); the existing Accept makes it live. Nothing live changes until Accept.
- **Loyalty advisor — baked-in now** (admin-editable guidance table is a separate later contract). The strategy lives in the suggest system prompt; advice rides the existing `reasoning` → `custom_description` field already shown on cards.
- **Owner cost-capture** — owners confirm per-dish costs (stored in `meal_restaurant_learnings`, `learning_type='cost'`, `owner_confirmed=true`); the suggest prompt consumes them so "low cost" advice is margin-grounded.

## Non-goals (this round)

- No admin-editable guidance UI (next contract).
- Modify-chat targets restaurant offers only (no fashion / other verticals — those have no AI-suggest engine yet).
- No change to the customer-facing meals flow, orders, escrow, or money math.

## Affected surfaces

- `backend/migrations/082_meals_offer_recommended.sql` (+ `scripts/run-082.js`) — `meal_offer_rules.recommended boolean DEFAULT false`.
- `backend/src/services/ai/{client,mock,index}.js` — suggest prompt (multi + advisor + recommended), new `modifyOffer`.
- `backend/src/services/meals.service.js` — persist `recommended`, attach owner costs to menu, `modifyOfferByChat` (preview-only), `getMenuWithCosts`, `upsertProductCost`.
- `backend/src/controllers/meals.controller.js` + `routes/meals.routes.js` — `POST /meals/offer-rules/:id/modify-chat`, `GET/PUT /meals/menu-costs`.
- `Packages/brand-web/app/dashboard/meals/page.js` + `lib/api.js` — recommended badge, advisory reasoning line, modify-chat panel, cost editor.
