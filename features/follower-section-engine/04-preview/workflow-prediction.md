# Workflow prediction — Follower Section Engine (Phase A)

> The mirrored mockups (`mockups/*-comprehensive.html`) are the LOCKED Creator
> Vibe designs (`design/wave4-creator-vibe/`, 2026-06-01). They show the **target
> follower screens + their admin Section Managers**. Phase A is **backend-only** —
> it does not render any of these screens; it produces the `{ sections: [...] }`
> data that Phase C's mobile `<SectionRenderer>` and Phase B's admin UI consume.

## What each mockup maps to in Phase A
- `home-comprehensive.html` → seed of `screen='home'` (9 shelves) + `GET /home`.
- `category-comprehensive.html` → `screen='category'` template + `/section/category/:key`.
- `offers-comprehensive.html` → `screen='offers'` template + `/section/offers`.
- `creator-store-comprehensive.html` → `screen='creator_store'` + `/section/creator/:handle`.
- `creator-category-comprehensive.html` → `screen='creator_category'` +
  `/section/creator/:handle/category/:cat`.

## Predicted Phase A "workflow executes to end state"
1. Admin (later, Phase B) will reorder/toggle/count these shelves; Phase A seeds
   the defaults exactly as the mockups' Section Manager panels show (e.g. Home's
   "New This Week" seeded **off**, "Top in Eat" rails as Brands/Products/Offers).
2. `GET /v1/follower/home?city=Vijayawada` returns the left-phone shelf list in
   order, each filled by its rule, each card carrying `via @creator` 4-ID tracking
   (the `.vc`/`.by` "via @creator" chips in the mockup).
3. The reels FAB/shelves in the mockups are **placeholders** — not seeded (52.8).

## Mockup-lock status
These mockups were locked at the design phase (SECTION-CATALOG.md, 2026-06-01).
Phase A touches no `Packages/*/(src|...)` path, so gov-check Rules 3/4 (mockup-lock,
before/after-diff) do not gate this backend-only phase; they will gate Phase C
when the mobile renderer ships against these same mockups.
