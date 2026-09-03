# Pass 4 — erase the data (the safe eight)

Final pass of `Docs/THE_CUT.md`, and **the only irreversible one**.

## What was actually done, and why it is smaller than planned

The plan said "drop everything retired". A safety check against surviving code found
that **only 8 of 29 retired tables were genuinely unreferenced.** The other 21 are still
named by code standing under features the founder KEPT — most importantly, accepting a
creator's pitch still writes a `collab_agreements` row.

So the founder's decision was revised, on recommendation: **finish the code removal,
drop only the provably-safe eight, and leave the rest in place.** Dead data costs almost
nothing; dead code runs. And code removal is reversible while dropping data is not.

## Dropped (8)

`referral_applications` · `enquiry_leads` · `lookbook_products` · `experience_products` ·
`creator_experiences` · `experience_themes` · `design_presets` · `design_tokens`

**74 records**, all exported to `backend/exports/2026-09-02-pass4/` first.

That is the visual design system the founder asked to be rid of — moods, palettes, type
styles and 24 ready-made shop themes, seeded 10-13 July and **never read by one line of
code in any app or website.**

## NOT dropped, and why

- **`experience_templates`** — the live app-layout table (`section_config`, which holds
  the shelves the shopper app renders) has a foreign key to it. Dropping it would mean
  altering a live table to remove a real constraint. Its single row stays.
- **The other 20 retired tables** — still referenced by surviving code.
- **`restaurant_reviews`** — was on the original list and is a **kept feature** wearing a
  retired era's name. Empty today, joined on every product card.
- **`product_addon_groups`** — sounds like dish toppings; the fashion product grid reads
  it on every row.

## The guards

Four, in order, because this cannot be undone:

1. **Re-scan the source tree at drop time** — any table named in surviving code is refused.
2. **Re-count rows at drop time** — a table that grew since the survey is refused.
3. **Export to JSON and read the file back** before dropping.
4. **One transaction, no CASCADE** — a dependency aborts everything.

Guard 4 fired on the first attempt and rolled the whole thing back. That is how the
`section_config` dependency was found — and how a live constraint avoided being cut.
