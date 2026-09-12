# item4-campaigns-sets — before / after

**Before:** the founder's locked mockups (`04-preview/mockups/item4-campaigns-sets-locked.html`, C1–C11,
updated 12 Sep with the declined count). On the phone before this item: a "Campaigns are coming soon" tab.
On the server: campaigns and sets existed with the date columns but no rules — nothing was locked,
nothing expired, a set with signed contracts could be deleted, duplicate copied every creator.

**After:** the screens as built, verified by render tests (12 new, whole mobile suite 441 / 441) and the
backend rules verified against the real database (13 new tests). No device was attached to this session,
so there are no phone screenshots; the founder's walk of checks 1–26 is the functional gate.

## Screen by screen

| Mockup | Built as | Differences from the mockup |
|---|---|---|
| C1 Campaigns tab | `BrandCampaignsScreen` + `CampaignCard4` | None. Waiting and declined are printed only when non-zero, exactly as the mockup prints "7 invited · 7 signed". |
| C2 Empty / loading / couldn't load | same, shared `Skeleton`, `LoadErrorList` | None. |
| C3 New campaign | `BrandCampaignNewScreen` | None. The counter counts real characters ("Diwali Edit 2026" is 16, the mockup's 17 is example data). |
| C4 New set | `BrandSetEditScreen` + `BranchSheet4` | None. The same screen edits a draft, renames a live set (other fields disabled with the lock note) and is "Choose a new date". |
| C5 Posting date picker | `DateField` (re-themed, Monday-first grid, confirm step, footer) | None. |
| C6 Campaign detail | `BrandCampaignDetailScreen` + `SetCard4` | None. Delete is hidden rather than disabled once invitations exist (§6.8 allows either). |
| C7 Set detail · draft | `BrandSetDetailScreen` | None. "Add creators" toasts "Coming soon". |
| C8 Set detail · live | same | None. Lock icon on every locked row; "waiting to answer" on the detail line. |
| C9 States | `SetCard4` extras + `BrandSetDetailScreen` | Completed shows "{n} collaborations" without "last one ended {date}": no collaboration carries an end timestamp yet (gap report §8). |
| C10 Duplicate | `DuplicateSheet4` | None. |
| C11 Menus | `ActionSheet`, `TextSheet4`, `ConfirmSheet` | None. |

## The rules, proved on the real database (`backend/tests/item4-campaigns-sets.test.js`, 13 tests)

| Rule | Result |
|---|---|
| Campaign name ≤ 60, description ≤ 200, exact messages; group remembered; another brand's group 404 | pass |
| Set name / Aim / mode / branch / date messages; 7-day rule; client cutoff ignored; branch must be this brand's | pass |
| Lock after the first invitation: Aim, date, mode, branch refused with `LOCKED` and the exact message; rename works; unchanged locked fields tolerated | pass |
| Delete: a set with any invitation refused; its campaign refused; contract count unchanged; a declined creator still counts; an empty draft campaign deletes | pass |
| Duplicate: settings + channels + branch copied, zero creators, "(copy)" then "(copy 2)", explicit clash 409, rollup recomputed, letter rule never reuses a letter | pass |
| Counts: invited 5 · signed 2 · waiting 2 (accepted + invited) · declined 1 on set, campaign and list; tabs | pass |
| Date passed: flagged, invite refused with the exact message, a new date reopens it; Completed stand-in flips with a waiting row | pass |
| Cross-set: declined / expired / deferred / rejected / slots_filled never 409; a live row 409 | pass |
| After the cutoff: "Invitations for this set closed on 17 Oct 2026." | pass |
| Expiry job: nobody signed → expired, 2 open invitations closed, declined untouched, past tab, second run a no-op | pass |
| Expiry job: one signed → kept, open invitation untouched; a legacy set with no date never expires | pass |
| Another brand: 404 on the three new endpoints, 403 on the old; a creator token cannot read the tab | pass |
| Branch in use: 422 `BRANCH_IN_USE` with the message; the branch stays | pass |

## Legacy behaviour that changed on purpose
- **Locks.** Nothing was locked before item 4. A live set's Aim, posting date, mode and branch can no
  longer be edited by anyone, including the website (which does not edit sets anyway).
- **Set delete.** Before: no guard beyond "keep one set", and the cascade destroyed signed contracts. Now:
  any invitation blocks it. The "keep at least one set" rule is gone — a campaign is a container.
- **Create set.** A posting date, an Aim and a mode are now required for every caller. Fourteen legacy
  test suites (27 fixture payloads) gained `go_live_date` and `shoot_mode`; no assertion changed.
- **Duplicate.** Copies settings only; a new posting date is required.
- **Rename.** A published campaign can be renamed and its description edited (mockup C11); one legacy
  assertion updated to the new rule.
- **Seven days.** Was five, on both sides; the client test that pins them updated.

## Website (APPROVAL.md §2.2, §2.3)
- `app/dashboard/influencers/[id]/page.js`: both "+ Invite to Campaign" buttons replaced by "Invitations
  are sent from the INFLX Brand app…"; the modal is kept in the file and never rendered.
- `app/dashboard/settings/profile/page.js`: the Branches & Outlets editor replaced by "Branches are
  managed in the INFLX Brand app…"; the save no longer writes `listing_data.branches`. Both pages
  parse-checked. Nothing else on the website changed.

## Test results
- Item 4: backend 13 / 13; mobile 12 / 12. Whole mobile suite **441 / 441** (35 suites).
- Backend whole suite: see the line below, filled in after the run.

Backend whole suite, first run after item 4: **231 failed / 912 passed / 1143** — the two new failures against the baseline (229 / 901 / 1130) were both in `item2-settings-api`, whose set helper sent a Store Visit set with no posting date and no branch; that is rule drift, the helper now sends both, and the suite re-runs 22 / 22. Confirming full run: **229 failed / 914 passed / 1143 total** (47 failed / 64 passed / 111 suites) — the same 229 failures as the baseline, 0 new failures, 14 new tests all passing (13 item 4 + 1 renamed).
