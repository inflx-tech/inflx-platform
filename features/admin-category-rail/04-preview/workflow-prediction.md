# 04 — Workflow prediction (mockup-lock)

Mockup `mockups/category-picker.html` = the admin node-picker (founder approved the
plan + said "start building" 2026-06-27 → lock delegated).

Predicted behaviour the implementation must match:
- App Builder section "Category rail (pick from catalogue)" expands to a **tree pick
  list** (indented by depth: Men → Bottomwear → Jeans), tapping a node toggles it
  (highlighted + ✓ when selected).
- A **selected-tiles list** below, each row = label input + icon input + remove ✕;
  default label = the node's name.
- Picker only active on **fashion / furniture** worlds (catalogue tree); other worlds
  show a note.
- Publish persists `config_json.nodes[]`.
- In the follower app the rail shows the picked categories; tap → the Phase-1 browser
  at that node.
