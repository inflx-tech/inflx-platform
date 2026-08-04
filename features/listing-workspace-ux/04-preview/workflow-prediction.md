# Workflow prediction — Listing Workspace UX

> What the founder will see when the mockup becomes the real screen.
> Mockup: `04-preview/mockups/listing-workspace.html` (4 states, switched from
> the black bar at the top — that bar is mockup-only chrome and does not ship).

## State 1 — "Add · browsing tree"

Opening Listings lands here. Left rail lists the whole Fashion tree with counts;
Men is expanded. Centre shows Men's 12 categories as cards that spread the full
width instead of a narrow column, plus a "Jump back in" strip of recently used
item types. No right rail yet — nothing is staged.

**Prediction:** clicking `Shirts` in the tree expands it in place and swaps the
centre to Shirts' item types. Clicking a card does the same thing. Nothing else
on the screen moves.

## State 2 — "Add · leaf wizard"

Reached by clicking any item-type (leaf). Centre becomes the familiar 4-step
wizard — same steps, same fields, same validation — but the fields are spread
over a 12-column grid so Basics fits on two rows instead of six. The right rail
appears with the staged batch and the Save button.

**Prediction:** "+ Add this item" pushes a row into the right tray and resets
the form; the tray stays visible while you add the next product. "Save 3
products" is one `batchCreate` call, exactly as today.

## State 3 — "Inventory"

Left rail is the brand's own tree with product counts. Centre is a table. Right
rail is stat tiles + filters.

**Prediction:** ticking rows reveals the black bulk bar. Hide / Show / Remove /
Edit price loop the existing per-product endpoints and report an honest
`n updated, m failed`. The two greyed-out ideas from the first draft — Move
category and Attach offer — are **not** in this build; they need backend work
and are recorded as out of scope in `01-spec.md`.

## State 4 — "Offers"

The existing `OffersLibrary` component, re-housed in the same shell with a
left rail for offer kind. Its internals are untouched this round; the cards
drawn in the mockup illustrate the shell, not a rewrite of the offer engine.

## What should NOT change

Wizard steps and validation · SKU generation · Excel import and its error
copy · photo crop-to-frame · tags · edit mode · every API call on the page.
