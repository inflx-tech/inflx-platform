# item2-pitch-invitation-settings — before / after

**Before:** the founder's locked mockups (`04-preview/mockups/item2-settings-locked.html`).
**After:** the screens as built (Phase 3), verified by render tests rather than device screenshots —
the founder's device walk is the release gate (checks 1–17 in `03-expected-outputs.md`).

## Screen by screen

| Mockup | Built as | Differences from the mockup |
|---|---|---|
| B1 Profile row | `BrandProfileScreen` → new "Creators" card: Pitch settings row (summary + On/Paused chip) and a temporary "Find a creator" row | The brand profile stays an inline form (item 3 makes it a row list). The finder row is not in the mockup; it exists only so X4 can be reached on a phone until item 3. |
| B2/B3 | `BrandPitchSettingsScreen` | None in copy or order. Yellow only on Save. Chips ink-on-white. |
| B4 | `PickerSheet` | None. |
| B5 | `ConfirmSheet` | Info box reads "Pitches you've already received stay open for you to answer." (founder 2026-09-11; no 30-day mention). |
| B6 | same screen after save | None. "Open pitches" → placeholder screen until item 8. |
| B7 | `BrandBlockedCreatorsScreen` | None. |
| B8 | `Skeleton` / `LoadError` / `SaveBar` / `useToast` / `useUnsavedGuard` | Discard prompt is a native Alert with Discard / Keep editing. |
| C1 | `ProfileScreen` → new "Brands" card: Invitation settings row + temporary "Find a brand" row | Payout & tax stay in Profile (no Wallet screen exists; founder Q12). |
| C2/C3 | `InvitationSettingsScreen` | None. Info box "Turning an Aim off hides its card…" shows while there are unsaved changes. |
| C4/C4b | `StateCityPicker` | None. |
| C5 | `ConfirmSheet` | None. |
| C6 | same screen after save | "Brands see on your profile" preview appears above the form after a save. |
| X1/X2 | `BrandOverviewScreen` | Minimal header (logo, name, sub-categories · city); products/posts sections are item 3. Pitch button enabled only when OK, non-functional until item 8. |
| X3 | ⋯ → `ActionSheet` → `ConfirmSheet` | None. |
| X4 | `BrandCreatorProfileScreen` | Minimal header; Invite button disabled until item 5. |

## Not in the mockups, built on the founder's instruction (APPROVAL.md)
- Brand registration (app + website) and Business details (app + website): "What you sell" — the eight
  sub-categories, at least one required (check 15).
- Creator Content preferences: languages and niches now come from the server lists; exactly one niche is
  required to save (check 16).
- Brand website: the old "who can pitch us" filter panel is gone; a notice points to the Brand app.

## Test results
- Mobile: 29 suites / 388 tests pass (33 of them new for this item).
- Backend, this item: 2 suites / 41 tests pass.
- Backend, whole suite — before vs after: see the table below (filled from the two full runs).

| Run | Suites failed / total | Tests failed / passed / total |
|---|---|---|
| Before (HEAD ec236ca, clean worktree) | 69 / 98 | 474 / 521 / 995 |
| After (this item) | 69 / 100 | 474 / 562 / 1036 |

New failures introduced by this item: **0** (compared test by test; the 41 extra passes are the two new item-2 suites).

The pre-existing failures are dominated by the test factory registering brands as `restaurant`, which the
fashion-only gate has rejected since 2026-09-02 (832 occurrences of that message in the baseline log). That is
test debt outside this item and was deliberately left alone so the comparison stays like-for-like.

## Deploy record (2026-09-11, founder go)
1. Migrations 168 + 169 applied to production first (`run-168-169.js --apply`; all 13 checks OK, 9 brands / 25 creators / 0 pitches untouched).
2. Commit `4cccea2` pushed to `main` → Render (new route `/v1/reference/brand-categories` answers 401, a fake sibling 404) and Vercel.
3. OTA published: **brand 210**, **influencer 198** (native runtime 3). First brand upload hit a Cloudflare 502 while Render was restarting; the retry succeeded.
