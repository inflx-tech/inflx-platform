# 03 — Expected outputs

- `navigateCategory(cat)` with `cat.key==='all'` and `cat.vertical` →
  `navigation.navigate('CategoryBrowser', { vertical, title: 'All categories' })`.
- `CategoryBrowserScreen` with `{ vertical }` and no `nodeId` → loads `/listing/tree`,
  drills the first segment, shows its categories as the rail + first leaf's products.
- Filter sheet: handle bar; `vpillOn` = solid `TZ.pink` + white text; rounded (radius 20)
  pills; sheet radius 22 + more padding.
- No change to the products/filters API or data.
