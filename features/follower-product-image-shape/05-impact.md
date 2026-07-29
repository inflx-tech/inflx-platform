# 05 — Impact

**Verdict: styling only. Seven files, no logic, no backend, no schema,
no API. Every large product tile stops re-cropping a photo that was
already cropped once at upload.**

## Mechanics

- **Schema / backend / API:** none. Nothing outside
  `Packages/Mobile/src/**` is touched.
- **Data:** none read or written differently. The same `image_url`
  renders in a different box.
- **Components:** one shared component (`ProductCard`) plus six
  screen-local styles.

## Behaviour changes worth naming

1. **Every large tile gets taller.** A 3:4 box exceeds the fixed
   heights it replaces, so grids reflow and fewer cards fit per
   screen. Intended, but it is the most visible consequence.
2. **Un-cropped images are now centre-cropped to 3:4 on large tiles.**
   Uploads that bypass the crop (paste-URL, Excel, photo-tray, mobile
   gallery) previously got a different arbitrary crop per screen; now
   they get one consistent 3:4 `cover`. Not a regression — the same
   `cover` behaviour already applied — but it is why
   `ProductDetailScreen` keeps `contain`.
3. **Two order thumbnails grow ~4px.** Cart is untouched.

## Risk

Low, concentrated in one place: **`SavedScreen`**. It was the only
site needing three coordinated edits — wrapper, image and placeholder.
Getting the placeholder wrong would collapse empty tiles to zero
height, and that only shows on a product with no photo, which is easy
to miss in a quick pass. Called out explicitly in the workflow
prediction so it gets looked at.

`ProductCard` carries the widest blast radius (two screens), but both
parents supply `width: '48%'`, verified, so `aspectRatio` resolves.

## Verification honesty

`pnpm qa` exercises brand-web. This change is Mobile-only, so a green
run proves **no regression elsewhere** — it does not prove the tiles
look right. The visual result is confirmed by the founder's combined
brand + follower end-to-end pass.

No Maestro run is required while `release.released` stays `false`
(gov-check Rule 5 only fires at release-flip). It stays false, per the
standing rule that verification happens once at the end, not per
slice.

## Classification

**Production-impacting — Mobile runtime.** Ships via an **OTA bundle**,
not by `git push`. Pushing the commit changes nothing for users; the
OTA publish is a separate step requiring explicit founder go.

## Deliberately not done

Extracting the duplicated tile styles shared by
`CategoryBrowserScreen` and `SectionResultsScreen`. Both are on the
do-not-touch list and are already correct; refactoring them would add
a component and edit two working screens for zero visual change.
Recorded for a follow-up contract.
