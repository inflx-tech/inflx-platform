# creator-handle-change-review — spec (DRAFT for the founder's lock)

Founder, 19 Sep 2026, looking at Influencers → Pending Verification: "If any creator changes his
account then those account details need to verify by admin again, then our system will scrape
those details and update. Here in admin it is showing in small letters at the top, below it is
showing the old one. Make it proper: this creator changed the channels, verify those belong to
them; after clicking Verify, those things change and our system calculates those channels' stats."

**Scope: the admin Pending Verification row and the verify action behind it.** Approved creators
who change a handle already go to the Handle checks tab (rules doc §2A, item 3b) — that tab is
untouched, but gains the same old → new presentation for consistency (one component).

## What is wrong today

A creator registers with one Instagram (the "claim" the queue row is built on) and before
approval changes it, or her YouTube, from the profile. The row then shows the **old** handle
large, with SCRAPE PENDING, and the **current** handles in ten-point grey at the top ("signed up
as @…"). Admin verifies the old profile. The system does measure the current accounts after
verify (they were saved waiting for approval), but the record admin approved names the old
handle, and nothing on the screen says a change happened.

## The row after this change

For every creator in Pending Verification the row leads with **what is to be verified now**:

- **Current channels**, large, each a link: Instagram @handle · YouTube handle.
- When either differs from what she signed up with, an amber block **"Changed since signup"**:
  `Instagram  @anusha9somepalli → @stories_by_srilok` · `YouTube  anusha1298 → stories_by_srilok`,
  with the line *Check the new ones belong to her before verifying.*
- The scraped-profile facts (followers, tier, bio email/phone, requested-at) stay, under the
  current handles, labelled as the signup profile.
- Buttons: **Verify & approve** · **Reject**.

Unchanged creators look as they do today, minus the tiny grey line.

## What Verify does

1. As today: the claimed profile becomes verified, cluster siblings are auto-rejected, the
   creator is approved, and every current account is confirmed and queued for its first
   measurement (profile numbers now, posts now).
2. **New:** the claimed profile's handles are rewritten to the creator's current handles at the
   moment of verification, so the record admin approved names the channels admin looked at, and
   later matching (leads, invitations) finds her by the right handle.
3. **New:** the approval refusal (registration-and-profile §6) stays: an incomplete profile is
   refused with the missing list, before anything above.

Nothing about measurement changes: the item 3b pipeline measures whatever accounts are
confirmed, and "Changed since signup" is the only visible addition. Reject is unchanged.

## What the server gains

`GET /admin/creator-verifications` rows gain `current_accounts: [{ platform, handle, url,
state }]` and `changed: [{ platform, from, to }]` (empty when nothing changed).
`POST /admin/creator-verifications/:id/verify` rewrites `creator_profiles.ig_handle /
youtube_handle` from the current accounts inside its transaction.

## Out of scope

Approved creators' changes (Handle checks tab does the verification; only its presentation is
aligned). Automatic ownership proof (a code in the bio, for instance) — a later version.
