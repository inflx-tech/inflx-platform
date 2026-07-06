# Workflow prediction — Phase 0

- Admin picks "Category browser" anywhere (wizard step 4 / inline "On tap,
  go to…" / a frame tile): a world select + node select appear side by side;
  node options come from that world's listing tree (fashion/furniture),
  indented by depth. Non-tree worlds show a hint to use Product grid.
  Changing world resets the node. Missing node blocks finish/Publish with
  the plain-language message (no more backend 422 banner).
- Admin sets a past "Disappears": red warning under the schedule inputs;
  wizard finish jumps back to step 3 with the same text. End time < 6 h
  away: amber heads-up, not blocking. Inline editor shows the same
  warnings but never blocks Publish (existing expired rows are editable).
- Follower on a business page: deals strips contain only that brand's
  offers; Home unchanged. Creator stores stop showing un-pushed products.
