# item3-discovery-profiles-groups — workflow prediction

Mockups: `mockups/item3-discovery-locked.html` (founder-locked 11 Sep 2026). Predicted behaviour per
screen, written before the build and kept as the reference for `06-diff/notes.md`.

| Screen | Predicted | Built as |
|---|---|---|
| A1 Brand profile | Row list; header logo · name · "Fashion · City" · status; reminders in orange | `BrandProfileScreen` (route `BrandProfile` kept) |
| A2 Business details | Logo upload (5 MB, client + server), name*, About ≤200 with counter, contact*, GSTIN, phone + major category locked | `BrandBusinessDetailsScreen` |
| A3 Sub-categories | Eight chips, at least one, Save bar | `BrandSubCategoriesScreen` |
| A4 Branches | Cards with Main chip; Edit / Open in Maps / Remove; Add a branch | `BrandBranchesScreen` |
| A5 Branch edit | Name*, Google address search, Make main, Save branch; new-city toast on return | `BrandBranchEditScreen` + `PlaceSearchField` |
| A6 Coming soon | Six copies from §6.1 | `ComingSoonScreen` |
| A7 Creator profile | Row list; no notifications switch; Payment & tax as a row | `ProfileScreen` (route `ProfileMain` kept) |
| A8 Profile info | Photo, name*, bio ≤150, city via Google, Instagram locked, YouTube, numbers read-only | `ProfileInfoScreen` |
| A9 Niche & languages | One niche required, many languages | `NicheLanguagesScreen` |
| D1/D2 Discover | Segments, search, quick chips, count · sort, cards, filter sheet with live count | `BrandCreatorsScreen` + `DiscoverList` + `FiltersSheet` |
| D5/W1 Worked with | Intro, search, rows with "N collaborations · last signed d Mon" | `WorkedWithPane` |
| G1–G7 Groups | Cards → detail → add (select mode) → name sheet → add-to-group sheet | `GroupsPane`, `BrandGroupDetailScreen`, `BrandGroupAddCreatorsScreen`, `GroupSheets` |
| P1–P4 Creator profile | Header + numbers + signed line + groups line + card/banner + collaborations + posts + links | `BrandCreatorProfileScreen` |
| F1 Collabs | Four segments, Pitch-a-brand card | `CollabsScreen` |
| F2/F3 Find brands | Search, quick chips, cards with status, filter sheet | `FindBrandsScreen` + `BrandList` |
| O1/O2 Brand overview | Header, about, accepts card/banner, Pitch, products, posts, branches, links | `BrandOverviewScreen` + `BrandOverviewBody` |
| O3 Product detail | Carousel, name, price, out-of-stock, category path, sizes, description, creator note | `ProductDetailScreen` |
| O4 Own overview | Info bar + same body + Edit details / Pitch settings | `BrandOwnOverviewScreen` |
