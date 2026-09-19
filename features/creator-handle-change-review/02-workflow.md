# creator-handle-change-review — workflow

## Actor
An admin on Influencers → Pending Verification.

## Preconditions
A creator registered with Instagram A (the claimed profile), then changed it to B and added
YouTube C from her profile before approval. Her profile is complete.

## Steps
1. Admin opens the Pending tab → her row leads with **@B · C**, the amber "She changed her
   channels after signing up" block shows `Instagram A → B` and `YouTube — → C`, and the signup
   profile's facts sit underneath labelled "Signup profile".
2. Admin checks B and C belong to her (the links open the channels), presses **Verify & approve**.
3. The row leaves the Pending list; the green line says the two channels are hers and measuring
   has started.
4. The claimed profile now names B and C; her accounts for B and C are `measuring`, ownership
   confirmed; the old account row for A is kept as replaced.

## Success definition
`creator_profiles.ig_handle = B`, `youtube_handle = C`, `verification_status = 'verified'`;
`users.status = 'approved'`; both current `creator_social_accounts` rows `measuring/confirmed`;
the replaced row for A untouched.

## Failure / edge workflows
- Profile incomplete → `PROFILE_INCOMPLETE`, nothing changes (registration-and-profile §6).
- A different scraped profile already carries handle B → the claimed profile keeps A and the
  response says `record_renamed: false`; the accounts are still confirmed and measured.
- Nothing changed → no amber block; Verify behaves as today plus the (no-op) rename.

## Build order
1. `creatorVerification.controller.listQueue` gains `current_accounts` + `changed`; `verify`
   rewrites the claimed profile's handles in its transaction.
2. `backend/tests/creator-handle-change-review.test.js`.
3. Admin `influencers/page.js`: `ClusterCard` / `ProfileRow` per V1/V2; Handle checks rows use
   the same old → new line.
4. Deploy on the founder's go: commit → push (Render + Vercel). No migration, no OTA.
