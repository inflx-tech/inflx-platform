# 04 — Workflow prediction

What the mockup asserts will happen, written **before** implementation so the
06-diff can be judged against a prediction rather than a memory.

## Screen-by-screen

**Step ② on entry, colours White + Blue, sizes S/M/L selected**
Two colour cards. Each shows a photo picker, then a row labelled
`Sizes & stock for <colour>` holding three chips — S, M, L — **all in the
switched-on state**, each with an empty numeric stock input beside it.
Prediction: the brand who does not care about per-colour sizes sees no new work.
The only visible difference from today is that the size label became a button and
the row heading now names the colour.

**Tapping S inside the Blue card**
That one chip goes to the off state — dashed border, muted fill, struck-through
label — and its stock input is replaced by an em dash. White is untouched.
Prediction: no full re-render flicker, no loss of already-typed stock values in
either card.

**Tapping S again**
Returns to on, stock input reappears **empty** (any previously typed value for a
switched-off size is not preserved, and is not sent). Prediction: acceptable —
re-enabling a size the brand explicitly removed should not silently resurrect a
stale count.

**All three off in one colour**
Amber hint `Pick at least one size for Green.` appears under that card and
**Next** is disabled. Prediction: the existing `stepBlocked` mechanism carries
this without a new pattern.

**Untick L in the top Size row**
L vanishes from both colour cards immediately. Prediction: per-colour lists are
read through the master list, so no stale chip survives.

**Free-size leaf (Saree)**
No Size row, no size chips inside colour cards — photo picker only.
Prediction: unchanged, because the whole block is already gated on
`selectedVariants.length > 0`.

## Visual language

Nothing new is introduced. The on/off chip reuses the existing `.vsize` pill and
the yellow-pale accent already used by `.tgc.on` for tag chips. The dashed +
struck-through off state is the only new styling, and it is a variant of an
existing class rather than a new component.

## What would falsify this

- Typing stock in White then toggling Blue clears White's values → state update
  is replacing rather than merging.
- The off state still submits a `sizes[]` entry → payload build still reads the
  global list.
- `facets.size` after save equals the top row rather than the union → union step
  missing.
