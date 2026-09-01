# Expected outputs

## Artefacts

- [x] `Docs/ACTION_MAP.md` — 47 actions, grouped by phase, with verdicts
- [x] `04-preview/mockups/atlas-brand.html` — 62 screens, no address gaps
- [x] `04-preview/mockups/atlas-creator.html` — 47 screens, no address gaps
- [x] `04-preview/mockups/index.html` — generated, not typed
- [x] `04-preview/mockups/book-1-getting-together.html` — 14 actions
- [x] `04-preview/mockups/book-2-committing.html` — 7 actions
- [x] `04-preview/mockups/book-3-the-shoot.html` — 7 actions
- [x] `04-preview/mockups/book-4-the-content.html` — 7 actions
- [x] `04-preview/mockups/book-5-the-money.html` — 12 actions
- [x] `04-preview/build-index.js` + `check-books.js` — both mutation-tested

## Verification — the check IS the artefact

```
$ node features/screen-atlas/04-preview/build-index.js
actions 47 · screens 109 · outside the action model 9
no problems

$ node features/screen-atlas/04-preview/check-books.js
5 book(s) · 47 of 47 actions covered
no problems
```

Both exit 0. Either exits 1 the moment the three documents disagree.

## Counts

| | Brand | Creator | Admin | Total |
|---|---|---|---|---|
| Actions | 24 | 18 | 5 | **47** |
| Screens | 62 | 42 | 5 | **109** |
| New actions | 7 | 6 | 2 | **15** |
| Two-party actions | | | | **28** |

## What is deliberately NOT here

- **No implementation plan.** The ordered migration list is the next artefact,
  written against this lock rather than inside it.
- **No code, no migration, no runtime change.** Deploy-inert.
- **No answer to the two open questions** recorded in `lock.json` under
  `open_questions`. They are held open on purpose rather than guessed.
