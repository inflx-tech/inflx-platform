# The atlas moved

It is a **locked design contract** now, so it lives where the governance tooling
looks for it:

```
features/screen-atlas/
```

| What | Where |
|---|---|
| Brand screens · SB-01…SB-62 | `features/screen-atlas/04-preview/mockups/atlas-brand.html` |
| Creator + admin · SC-01…SC-42, SA-01…SA-05 | `features/screen-atlas/04-preview/mockups/atlas-creator.html` |
| Index · action ↔ screen | `features/screen-atlas/04-preview/mockups/index.html` |
| The five Action Books | `features/screen-atlas/04-preview/mockups/book-1..5-*.html` |
| The 47 actions | `Docs/ACTION_MAP.md` *(stayed here)* |

Open them all together:

```
pnpm preview:open screen-atlas
```

Check them after any edit — both must exit 0:

```
node features/screen-atlas/04-preview/build-index.js
node features/screen-atlas/04-preview/check-books.js
```

**Locked 2026-09-01.** The seven `features/b1-*`…`b7-*` tab contracts it replaced
are marked `superseded` and stay `approved: false`, so none of them can back a
change. Their `lock.json` notes are kept — they record the round-by-round design
corrections and that history is not reproduced in the atlas.
