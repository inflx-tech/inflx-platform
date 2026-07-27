# Before / After — store preview tiles (B2-lite)

**Before:** `48.5%` cards with **96px** images, **11.5px** names on a `minHeight:30` clamp,
12.5px price — cramped, names effectively clipped.

**After:** **150px** images, **13.5px** names with `lineHeight:18` / `minHeight:36` so the
existing 2-line clamp actually renders two lines, 14px price, slightly larger padding and
placeholder glyph. Mirrors the web listing fix (B1·1).

## Scope note
B2 was **reduced deliberately**: the founder locked listing/product management as web-only,
so the store preview staying read-only is correct — the earlier "add product management to
mobile" plan is cancelled. This slice is polish only.

## Verification
- Mobile jest **105/105 green** (23 suites); styles-only change.
