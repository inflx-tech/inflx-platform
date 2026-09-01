# Screen Atlas — the locked design for the brand and creator apps

## What this contract is

**The design of record** for stages 1–4 of the brand and creator apps, organised
**by action rather than by tab**.

It is not an implementation contract. Nothing here ships code. It exists so that
every implementation slice that follows has one agreed thing to build from, and
so that "what does this screen look like" has exactly one answer.

## What it contains

| Artefact | What it is |
|---|---|
| `Docs/ACTION_MAP.md` | 47 actions — 24 brand, 18 creator, 5 admin |
| `04-preview/mockups/atlas-brand.html` | 62 brand screens, `SB-01`…`SB-62` |
| `04-preview/mockups/atlas-creator.html` | 42 creator (`SC-01`…`SC-42`) + 5 admin (`SA-01`…`SA-05`) |
| `04-preview/mockups/index.html` | **generated** — action ↔ screen, both directions |
| `04-preview/mockups/book-1..5-*.html` | every action: steps, forks, both phones, data, failure modes |

**109 screens. Each drawn once, with a permanent address.**

## The rule the whole design turns on

A **set** is one aim, one go-live day, one way of shooting.

Money is settled inside a set and changes nothing for anybody else. A day or a
shoot mode cannot be settled inside a set — other people already agreed to it —
so disagreeing about either one **moves her out**, into a deferred pool from
which a later set is built.

Every fork in the five books is a consequence of that sentence.

## What it supersedes

`features/b1-brand-campaigns-tab`, `b2-brand-creators-tab`, `b3-brand-home`,
`b4-b7-the-money`, `b5-creator-collabs-tab`, `b6-b8-shop-posts`,
`b7-creator-home`.

Those seven are organised **by tab** — how the app is built, not how anyone uses
it — so the same screen appears in several with a different description each
time. They are marked `superseded` and stay `approved: false`, so none of them
can back a change. **Their `lock.json` notes are kept**: they record the founder's
corrections round by round, and that history is not reproduced here.

## Checked, not asserted

Two generators, both mutation-tested, both run from `04-preview/`:

```
node features/screen-atlas/04-preview/build-index.js
node features/screen-atlas/04-preview/check-books.js
```

They fail on: a screen pointing at an action that does not exist; a screen no
action reaches and not tagged `[nav]`/`[all]`/`[out]`; an action with no screen;
a book whose screen list disagrees with the atlas in either direction; an action
no book covers; unbalanced or malformed HTML.

Between them they caught, during authoring: a bad action reference, a dropped
creator screen, a merged action with no screen declaration, a malformed tag, and
**the Action Map's own footer being wrong on nearly every number** — 42 actions
claimed against 47 actual, 19 two-party claimed against 28 actual.
