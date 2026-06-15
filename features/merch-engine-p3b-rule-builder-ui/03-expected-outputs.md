# Expected outputs — Section rule-builder UI (Phase 3b)

## Automated
1. `npm run build` (brand-web) → exit 0.
2. `pnpm qa` → GREEN, gate 0, zero regression.
3. Backend endpoints respond (admin-gated): list/create/update/preview return the documented shapes.

## Behavioural (admin, after deploy)
4. **List**: `/admin/section-library` shows existing sections grouped by business (empty state if none).
5. **Create**: open builder → pick **Fashion** → sub-category tree loads (Men/Women/… → Jeans),
   pick tags from the Fashion vocabulary, set price ≤ 499, sort newest → **preview shows
   "matches N products"** + sample thumbs → Save → row appears.
6. **Preview accuracy**: the preview count equals what the evaluator returns at platform scope
   (only approved + pushed products of that business matching the rule).
7. **Non-tree business**: pick **Food** → sub-category field is hidden (no tree); category+tags+
   price+sort still work + preview.
8. **Edit / hide**: edit a section's rule → preview updates; hide → leaves the list active set.
9. **Auth**: endpoints reject non-admin.

## Non-goals (NOT expected here)
- Sections rendering to followers (3c). Food/beauty/cars sub-category filtering. Trending sort.
