# registration-and-profile — amendment, 19 Sep 2026: approval is not a completeness check

Founder, 19 Sep 2026, on seeing "This profile is missing: photo. Ask them to complete it before
approving." on the Pending Verification row:

> "for approval it is not mandatory to complete all profile, main intention of approval is
> whether that account belongs to them or not … currently we don't have smart authentication
> system … for this reason we are having this approval system and scraping for creators …
> make it not mandatory for approval … this is manual process where our team check that
> accounts belong to that creator only."

## What changes

**§6.3 "approval refuses an incomplete profile" is withdrawn**, on both sides:

- Creator verify (`POST /admin/creator-verifications/:id/verify`) approves regardless of
  completeness. The response carries `missing_fields` as information.
- Brand approve (`PATCH /admin/brands/:id/status`, `PATCH /brands/:id/status`) approves
  regardless of completeness.

**What stays:** the one completeness rule (§6.2) still drives the profile tab's "N things left",
the red dots, the Submit for review button, the finish-profile sheet on the pending home, and
the admin review pages' missing list — as a nag and as information for the team, never as a
gate. The creator gate on actions while pending (§6.3, §6.5) is untouched.

## Why the original rule is withdrawn

Approval exists because there is no automatic proof that an Instagram or YouTube account belongs
to the person who typed it. The team checks that by hand and the platform then measures the
accounts. A missing photo or bio has nothing to do with that question, and blocking the team's
check on it held up the one thing approval is for.

## Tests

`registration-profile.test.js` checks 24 and 25 now assert that approval succeeds while the
profile is incomplete and that the missing list is still reported; `creator-handle-change-review`
check 5 the same. Tests that completed a profile before approving keep doing so — completing is
harmless.
