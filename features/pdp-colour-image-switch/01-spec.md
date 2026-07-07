# Product detail — colour switch shows that colour's photos

**Founder 2026-07-06:** on the product page, tapping a colour swatch doesn't
smoothly switch the hero to that colour's images.

## Root cause
The hero gallery was a UNION: `facets.images + image_url + cover_images +
activeColour.images`, deduped. So it always LED with image_url/cover_images
(colour 1's shots) and merely appended the selected colour's images at the end,
then reset imageIndex to 0 — landing back on colour 1's first photo. The
ScrollView had no key/ref, so its scroll offset went stale on colour change.

## Fix (mobile, OTA)
- Gallery now LEADS with the selected colour's images when that colour has its
  own photos (`colourImgs.length ? colourImgs : baseImgs`); otherwise the
  shared gallery.
- `<ScrollView key={selectedColour}>` remounts the carousel on colour change so
  it lands on that colour's first photo (no stale offset).
- Result: tapping a swatch switches the hero to that colour's photos.

## Out of scope
Adding PDP info sections (seller box, trust badges, inline description) — a
separate proposal.
