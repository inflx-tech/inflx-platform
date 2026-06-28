# 01 — Spec: brandstore-admin-composed (F2)

Founder-directed 2026-06-28: the brand/business store must be **admin-composed**,
not a hardcoded frontend layout. The food page (`RestaurantDetailScreen`) already
renders admin-composed `business` sections via `getBusinessSections` + the generic
section engine; the shopping brand store (`BrandStoreScreen`) never was — it ran a
hardcoded product-grid body and ignored the admin's composition.

## Principle (founder-locked)
> The screen is a **generic renderer**: it draws whatever sections the admin
> composed. Engineering is one-time; pages are data. The same engine serves Home,
> the brand page, and any future page — the admin composes, the renderer shows it.

## This contract
Make `BrandStoreScreen` (non-restaurant) render the admin-composed `business`
section stack via the **same generic `SectionItem` engine** the food page uses:
- Fetch `getBusinessSections(brand_id)`.
- When the admin has composed a business page → render that stack (each section's
  tap-destination handled by the engine).
- When nothing is composed → **fall back to the product grid** (so the store is
  never empty — no regression).
- Keep the fixed chrome: brand header (name/verify/trust/share), creator bar, the
  per-vertical CTAs (pay-at-store / book / order / enquiry), and the cart bar.

No new mockup (founder waived) — the look IS the live section engine, which the
admin controls. Reusable for the creator store + category page next.

## Out of scope
- Tap→destination chooser (P2) and page-creation (P4) admin features — separate.
- Full toing reskin of the fixed chrome (follow-up).

## Acceptance
- A brand with composed `business` sections shows them in its store; a brand with
  none shows its product grid. No regression to CTAs / cart / restaurant dispatch.
- `pnpm qa` green; mobile jest green; babel-clean.
