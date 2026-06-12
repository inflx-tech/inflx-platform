# Listing Add — Stepped Wizard (fashion + furniture)

> Contract slug: `listing-add-stepper`. Makes the per-product ADD flow easier
> by replacing the single giant leaf panel with a guided 4-step wizard.
> Founder direction 2026-06-12 ("make it little easy in clear steps"); the
> Excel bulk-import is a **separate follow-on** contract (sequence locked:
> stepper FIRST). See [[project-listing-add-redesign]].

## Problem (verified 2026-06-12)
`Packages/brand-web/app/dashboard/products/listing/page.js` drills the
taxonomy tree to a leaf, then renders **one panel with everything at once**:
cover photos + name/brand/price/stock/SKU + the leaf's **entire facet list**
(a Saree leaf = 14 facets) + per-colour variant cards. It's a wall of fields,
and validation is one lump dump ("Required: a, b, c, d"). The drill-down and
batch-add themselves are fine — only the leaf form needs restructuring.

## The insight
Every facet already carries a **`facet_role`** in `facet_definitions`
(`media`/`price`/`variant`/`discovery`/`descriptive`). The steps derive
straight from that role — **no new data, no backend change**.

## Goal / end state
A 4-step wizard at the leaf, same drill-down + same batch-add:

| Step | Content (auto-grouped by role) | Gate |
|---|---|---|
| ① **Basics** | cover photos · name · brand · price · stock | photo + name + price required to advance |
| ② **Variants** | Colour (→ per-colour pics + per-variant stock) · Size | colour required; **auto-skipped** when the leaf has no `variant` facets |
| ③ **Details** | all `descriptive` + `discovery` facets | required ones surfaced at top; rest under a "More details" group, skippable |
| ④ **Review** | summary card of the item | "+ Add this item" stages it → returns to ① for the next |

Plus: a **progress bar/step header**, **per-step inline validation** (replacing
the single dump), and **carry-over** of brand + common descriptive facets to
the next item so adding many similar products is fast.

## Scope
- **Brand-web only** — refactor `page.js`'s leaf panel into a stepper. The
  tree drill-down, `blankDraft`/`addItem`/`saveBatch`, the per-colour variant
  cards, and the `batchCreate` call are **reused verbatim**; we only re-lay-out
  which fields appear on which step and add step nav + per-step validation.
- Step assignment: partition `facets` by `facet_role` —
  variant→②, (descriptive|discovery)→③, media/price/identity→①.

## Non-goals
- Excel bulk import (separate contract, next).
- Any backend / `facet_definitions` / `batchCreate` / DB change.
- The store-setup flow (`listing_steps` in the schema) — untouched.
- Mobile — this listing wizard is web-only today.

## Verification
`pnpm qa` GREEN (brand-web listing specs still pass — the batchCreate
contract is unchanged); Playwright walk of the 4 steps for a fashion leaf
(variants present) + a furniture leaf (variant step behaviour); founder
preview-lock of the mockup before implementation; 06-diff before deploy.
