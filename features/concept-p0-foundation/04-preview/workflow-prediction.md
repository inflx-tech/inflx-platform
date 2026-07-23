# Workflow prediction — concept-p0-foundation

The only NEW UI is the campaign-wizard category picker (mockup:
`leaf-category-picker.html`). Prediction:

1. Brand with a fashion catalogue opens the wizard offer config, taps
   "Category" → sees full-path tree rows with live counts instead of the flat
   section list. Picks "Men › Bottomwear › Jeans" → chip/label shows the leaf
   name; saving writes `category_node_id` + name.
2. Editing an existing campaign whose config carries only a string keeps the
   flat behaviour (string select) if no tree, or shows the tree with nothing
   preselected — the legacy string still resolves server-side, so nothing
   breaks if the brand saves untouched.
3. Food brand (no `category_nodes` tree): picker is byte-identical to today.

Everything else in this contract is deletion or backend-only; the UI
prediction there is absence: no Design System/Theme/Design Library/Exp.
Templates nav entries, no Master Dishes/Meals nav entries, Tax Summary
appears under SETTINGS, no Create Experience tile on the creator home, no
Experience Preview row in the follower profile.
