# 01 — Spec: Phase 5e/5f — Brand Store + Checkout/Remaining Sweep

**Contract:** `follower-rebuild-p5ef-store-checkout-sweep`
**Track:** Follower visual rebuild (Phase 5), steps 5+6 (Brand Store + Checkout/
remaining white-on-gold sweep). Founder direction 2026-06-16: **visual sweep now,
engine migration later** (the full Brand-Store→section-engine migration is a
separate, production-impacting backend build, deferred + to be scoped for explicit go).
**Surface:** Follower mobile only (OTA). No backend/DB/migration.

## 5e — Brand Store: VERIFIED NO-OP
`BrandStoreScreen` is bespoke (`getBrandStore` → brand/products/influencers/creator
picks; old `ProductCard`). Audited for the sweep: it already renders the gold/cream
palette via the `creatorVibe` token shim; its primary CTAs use the **per-business
accent** color (intentional wayfinding), the secondary is white-with-accent-border,
and there is **no white-on-gold** (no `C.brown` button text). `BrandActionRow`
likewise uses accent, not gold. **No code change required for the visual sweep.**
Swapping `ProductCard`→vibe kit = layout work, part of the deferred engine migration.

## 5f — Remaining white-on-gold sweep (completes the 5a sweep list)
Fix white text sitting on a `C.brown` (gold) background → `C.onGold` (ink):
1. `DealsScreen`: `chipTxtOn`, `pillTxtOn`.
2. `OrderHistoryScreen`: `tabTxtOn`.
3. `RestaurantDetailScreen`: `abtnTxt` (the Follow/Directions CTA).
4. `components/ErrorBoundary`: `btnTxt` ("Try again").
5. `MeScreen`: wallet card `wl`/`wb`/`wa` (white→ink variants) + refer `rbTxt`.

## Deliberately left (verified correct, not legibility bugs)
- `ProductDetailScreen.toggleKnob` — white knob on a gold switch **track** is
  standard switch UX (an ink knob would reduce contrast).
- `RestaurantDetailScreen.psizeOn` — active bg is `lightColors.ink` (white-on-dark,
  correct).
- `OrderHistoryScreen.dotTxt` — shared across step states; white is correct on the
  green "done" dot, and the tracker isn't on the sweep list.
- `OrderHistoryScreen.tgTxt`, per-business accent badges in legacy fallbacks —
  white on accent/status colors (intentional wayfinding), not gold.

## Acceptance
- `pnpm qa` GREEN gate 0 (mobile-only, inert to web/db lanes).
- No white-on-gold remnant on the live follower surfaces enumerated by the 5a list.
- `released:false` until the joint 5→6 founder verify.
