# Workflow prediction — Phase 3b (rule-builder UI)

Mockup: `04-preview/mockups/section-library.html` (navy admin theme).

Predicted admin flow:
1. Admin opens **Section Library** (new nav item) → sees sections grouped by business with a
   rule summary + live match count + Edit/Hide.
2. **+ New section** → modal: Name · Business · Sub-category (tree, fashion/furniture only) ·
   Tags (admin vocabulary) · Min/Max price · Sort · optional Image.
3. As filters change, the right panel shows **"N products match right now"** + sample thumbs
   (debounced call to `POST /admin/section-library/preview`, platform scope, gated count).
4. Save → row appears. Edit/Hide update in place.

What the mockup is asserting (for sign-off):
- The 5 filter fields = the locked set; sub-category is a tree (node + descendants), hidden
  for businesses without a tree.
- The live preview is the key affordance (see a rule's catch before saving).
- Navy admin theme (NOT gold/cream — that's follower-app only).
- Sections authored here are inert until placed (3c) — copy says "place it on a screen (next step)".
