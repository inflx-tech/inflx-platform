# Workflow prediction — concept-p1-engine

1. Admin opens /admin/concepts (new nav entry 💡 above App Builder). Category
   tab shows 27 seeded templates in 4 group cards; header counter ≈ 9,225
   addressable concepts once the tree loads.
2. Preview on "Winter {Category}" → leaf select (full-path rows, leaves only)
   → picking Jeans runs the live rule → "Winter Jeans", family 1, count +
   sample grid. With no matching products the modal shows the honest empty
   state, not an error (likely on prod today — few fashion products listed).
3. Preview on "Under ₹499" without a leaf → family 2 platform-wide count;
   with Jeans → "Jeans Under ₹499", family 4. Offer template "BOGO" + Jeans →
   "BOGO Jeans", family 5 — count 0 until a brand runs a live BOGO.
4. + New template with a bad shape (category name missing {Category}; price
   with no band; inverted band) → inline 422 message, nothing saved.
5. /admin/collections (🧺) lists the 14 seeded names; add/rename/hide work
   inline; duplicate name → friendly message.

Mockup: `mockups/concept-manager.html` (list + grouping + actions grammar;
the modals follow the existing tag-vocabulary modal pattern).
