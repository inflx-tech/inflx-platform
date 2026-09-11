# item3-discovery-profiles-groups — before / after

**Before:** the founder's locked mockups (`04-preview/mockups/item3-discovery-locked.html`).
**After:** the screens as built (Phase 3), verified by render tests and a release bundle build rather
than device screenshots — the founder's phone walk of checks 1–31 (`03-expected-outputs.md`) is the
functional gate.

## Screen by screen

| Mockup | Built as | Differences from the mockup |
|---|---|---|
| A1 Brand profile | `BrandProfileScreen` (row list) | None in rows or copy. Status shown with the existing `StatusPill`. The "no profile" recovery screen from before is kept. |
| A2 Business details | `BrandBusinessDetailsScreen` | None. Phone shows the **login** number masked (founder: the old field read `brands.phone`). |
| A3 Sub-categories | `BrandSubCategoriesScreen` | None. |
| A4 Branches | `BrandBranchesScreen` | None. Remove on the main branch shows the exact message instead of a disabled button. |
| A5 Add / edit branch | `BrandBranchEditScreen` | Address search lists Google predictions inline under the field (no separate screen). |
| A6 Coming soon | `ComingSoonScreen` | None; the six copies are the prompt's. |
| A7 Creator profile | `ProfileScreen` (row list) | None. Notifications switch removed; Payment & tax is a row → its own screen. |
| A8 Profile info | `ProfileInfoScreen` | Instagram shown locked (verified by INFLX); YouTube editable. |
| A9 Niche & languages | `NicheLanguagesScreen` | None. |
| D1/D2 Discover | `BrandCreatorsScreen` + `DiscoverList` + `FiltersSheet` | None in copy. Sort is a small inline menu, not a native picker. Niche and language chips show four / three with "+N more". |
| D5 Worked with | `WorkedWithPane` | None. |
| G1–G7 Groups | `GroupsPane`, `BrandGroupDetailScreen`, `BrandGroupAddCreatorsScreen`, `GroupNameSheet`, `AddToGroupSheet` | Member ⋯ is a small button on the row (no long-press). "New group" from inside G6 works inline. |
| P1–P4 Creator profile | `BrandCreatorProfileScreen` | "Blocked by you" chip next to the name; ⋯ offers Unblock when blocked (founder Q4). Signed line hidden at 0 (Q5). Posts grid is the empty state until item 13. |
| F1 Collabs | `CollabsScreen` | None. |
| F2/F3 Find brands | `FindBrandsScreen` + `BrandList` | None. |
| O1/O2 Brand overview | `BrandOverviewScreen` + `BrandOverviewBody` | None. Pitch shows the coming-soon toast (item 8). |
| O3 Product detail | `ProductDetailScreen` | None. |
| O4 Own overview | `BrandOwnOverviewScreen` | "Accepts pitches for" comes from the brand's own pitch settings (the public endpoint gives no summary to the owner). |

## Not in the mockups, built on the founder's instruction (APPROVAL.md)
- All four privacy leaks closed (address on the brand overview; shopper store `listing_data`
  whitelist; approved-only creator search/detail without the hard-coded verified flag; find-brands
  facets without `accepts_proposals`).
- Brand registration now creates the Main Branch row, so a brand registered after item 3 shows its
  city from day one (found by the item 3 tests).
- Test factory fixed first (fashion + one sub-category) as its own commit `6ff5a14`.

## Website side effects (no website code changed — open items for the website discussion)
1. **Website creator search stops showing pending creators** (`/influencers/search` is approved-only;
   `is_inflx_verified` now reflects the real status). A brand opening a pending creator's page gets 404.
2. **The website branch editor no longer changes branches.** Branches live in `brand_branches`;
   saving `listing_data.branches` from the website updates the JSON only, which nothing reads for
   cities any more. The city creators see comes from the main branch row.
3. **Group rules are now enforced for "Shortlist":** name 1–40 characters, unique per brand
   (case-insensitive), 100 creators, approved creators only (422 `NOT_APPROVED` for others).
4. Website group lists and counts **exclude suspended creators** (rows kept; back on reinstate);
   rejected creators are removed from every group.
5. Website brand detail / store pages no longer receive the brand's **street address**, phone or
   `listing_data.branches` from `/brands/:id/public` and the shopper store endpoints.
6. `/brands/me` carries `login_phone` and `business_phone`; `phone` now means the login number (the
   old response returned the business phone under `phone` when set).
7. Brands registered from the website also get a Main Branch row automatically.

## Test results
- Mobile: 3 new suites / 22 tests pass; the item 2 suites (36 tests) still pass; the release bundle
  builds (`react-native bundle --dev false`, 1.9 MB, no errors).
- Backend, this item: 8 suites / 62 tests pass.
- Backend, whole suite — the three baselines the founder asked for (`--runInBand`, private PG 18 cluster):

| Run | Tests failed / passed / total | Note |
|---|---|---|
| Before the factory fix | 474 / 521 / 1036 | factory registered brands as `restaurant` |
| After the factory fix (`6ff5a14`, clean worktree) | 229 / 807 / 1036 | 245 tests recovered by the fix alone |
| End of item 3, first full run | 233 / 865 / 1098 | 62 new item 3 tests all pass; 4 old tests newly failing — see below |
| End of item 3, final full run | **229 / 869 / 1098** | 0 new failures vs after-fix; 63 new tests (62 item 3 + 1 renamed) all pass; suites 47 failed / 108 |

**The four old tests that started failing** (test-by-test comparison keyed on file + test name, `compare.js`):
all four asserted rules that item 3 changed on the founder's decision, none is a behaviour regression:
1. `influencer-search` "includes pending influencers" — pending creators are now hidden from brands (Q14). Test updated to the new rule.
2. `admin-creator-review` "a brand gets the YouTube reach" — the fixture creator was pending, so a brand now gets 404 (Q14). Test now asserts the 404, approves her, then the original privacy assertions.
3. `item2-eligibility` "Store Visit needs one of the brand's branch cities" — the last case relied on a branch typed into `listing_data`; branch cities now come from `brand_branches` (website side effect 2). Test now inserts a branch row and asserts the JSON alone no longer counts.
4. `item2-settings-api` "reference lists" — 17 states / 63 cities became 36 / 92 (Q9). Numbers updated.
Zero tests fixed by accident, zero tests gone.
