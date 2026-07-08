# Impact — category-search

**Verdict: replaces a wrong nav with a real search; additive backend param.**

- Backend: node-products endpoint gains an optional `q` (name/description ILIKE
  within subtree). No effect when absent.
- Mobile: ⌕ toggles an inline search bar instead of navigating to Find; grid
  re-queries with the text. No other flow changes.
- Production-impacting: Render (backend) + mobile OTA.
- Rollback: revert one commit (⌕ back to opening Find; q ignored).
