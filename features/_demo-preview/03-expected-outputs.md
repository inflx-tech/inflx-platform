# Expected outputs — _demo-preview

The preview-machinery, run against this contract, produces:

```
qa/artifacts/preview/_demo-preview/index.html
qa/artifacts/preview/_demo-preview/mockups/01-follower-public-browse.html
qa/artifacts/preview/_demo-preview/mockups/02-search-with-verified-tag.html
```

The `index.html`, opened in a browser, shows:

- **Header:** "_demo-preview" feature name + slug + "DEMO — never
  released" badge (yellow).
- **Mockups section** (2 cards):
  - "follower public browse" — 380×720 iframe (mobile portrait)
  - "search with verified tag" — 1200×720 iframe (desktop wide)
  Both have an "open full ↗" link to view standalone.
- **Workflow prediction section** — full markdown of
  `workflow-prediction.md` rendered with sections (Trigger, Steps,
  End state, Edge cases, What changes vs current, Blast radius).
- **Spec excerpt** — first 60 lines of `01-spec.md`.
- **Footer** — instructions on how to set `mockup_locked: true` in
  a real contract's `lock.json`.

Browser console is clean. Page renders in under a second on any
modern browser.
