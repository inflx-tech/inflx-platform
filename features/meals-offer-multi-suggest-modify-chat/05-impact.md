# 05 — Impact

**Verdict: additive, restaurant-side only — zero disturbance to customer meals, orders, escrow, or money math.**

## Mechanics

- **DB:** one new nullable-with-default column (`meal_offer_rules.recommended`). No existing column/table altered. Migration 082 idempotent (`ADD COLUMN IF NOT EXISTS`); existing rows default false. Re-apply = zero delta.
- **Suggest path:** same endpoint/insert shape + one extra column + richer prompt. `meals-suggest.test.js` contract preserved (family + ≥3 sizes, prices joined, Accept→active).
- **New endpoints (additive):** `POST /meals/offer-rules/:id/modify-chat` (preview-only, writes nothing), `GET/PUT /meals/menu-costs` (owner-private cost learnings). All gated by `requireRole('brand') + requireBrandFeature('meals')` — non-restaurant brands get 403.
- **AI:** `modifyOffer` added; existing AI signatures unchanged. No-key → deterministic mock fallback (no 500). AI never sets prices (joined from `brand_products`).
- **brand-web:** Meals page only — badge, advisory line, modify-chat panel, cost editor. Other dashboards untouched.
- **Cost data:** owner-confirmed, `owner_confirmed=true`, never AI-guessed, never shown to customers.

## Regression surface

Meals restaurant-side only. Full backend jest re-run for proof (see 06-diff). No mobile change. brand-web is a Meals-page-scoped restyle+additions under the existing `.ml` palette.

## Deploy posture

PRODUCTION-IMPACTING: migration 082 (Render→Supabase) + `backend/src` + `Packages/brand-web` (Vercel). Surfaced for explicit founder go; never silent. ANTHROPIC_API_KEY already set on Render by founder (2026-06-02) — live AI active; mock is the safe fallback.
