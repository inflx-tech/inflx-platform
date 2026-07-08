# Before/after — category-browser-counts-search

## Before
- Rail categories showed a name only; no product count.
- Header search (⌕) and share (⤴) buttons had no onPress — dead.

## After
- `getNodeChildren` returns a per-child live product count (recursive subtree).
- Rail renders "N items" under each category name.
- Header ⌕ opens the Find/search screen (passes current vertical). Dead share
  button removed.

## Verification
- Count query validated on dev DB (returns per-child subtree counts).
- `pnpm qa` GREEN (79); CategoryBrowserScreen babel-parses.
- On-device after-capture owed on the OTA.

## Deploy
Render (backend) + follower OTA.
