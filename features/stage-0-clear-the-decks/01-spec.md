# Stage 0 · Clear the decks

**Locked by the founder 2026-08-20.** Plan: `Docs/THE_PLAN.md`. Stage detail: `Docs/STAGE_0.md`.

Stage 0 has **no screens**. It skips the mockup gate. Its proof is data read back, not a
screenshot.

## Why this exists

Phase 0 (`features/collab-phase0-foundations`, commit `a8cf50f`) shipped five foundations and
is recorded complete. Two of them are unreachable: `collabStep.service.js` and
`collabCounts.service.js` are written, correct, deployed — and **nothing in the repository
imports them.** No route, no controller, no test. Verified 2026-08-20 by grepping the whole
tree.

Phase 0's own stated output was *"both apps can ask the server what step a collaboration is on
and how much is owed."* They cannot. Stages 1, 3, 4 and 10 of `Docs/THE_PLAN.md` all read those
numbers; without a doorway each app would derive them itself, which is the exact failure the
foundation exists to prevent (FINAL 4: *"Two things must be server-side — the step number and
the needs-you count"*).

Separately, no stage after this can be functionally tested. Production holds 1 contract,
1 shoot stuck at `proposed`, 1 post, **0 attributed sales**, 0 agreements, 0 groups, 0 diary
rows. The founder tests by using the apps.

## Scope — in

### A · The two doorways
1. **Brand.** Extend the existing `GET /brands/me/inbox-summary` with a `needs_you` block from
   `collabCounts.forBrand`. **Extend, never duplicate** — per `navigation.html`: *"One summary
   endpoint, extended… the new sources are added there rather than in five more calls."* The
   five existing counters keep their names and values untouched.
2. **Creator.** New `GET /influencers/me/needs-you` returning `collabCounts.forCreator`, plus
   her collaborations each carrying the server-derived `step` and `turn` — the creator's
   equivalent of what `forBrand` already returns per creator inside a campaign.
3. **Tests** for both. Neither service has one today.

### B · The practice world
Seeded into production, **created switched off** so it can never surface to a real follower:
brands unapproved-for-discovery or products inactive, campaigns unpublished, posts not live.
Follower-facing queries already filter on published/active/live, so no new hiding logic is
introduced.

Contents per `Docs/STAGE_0.md`: 3 brands, ~22 creators across AP/Telangana, 2 groups,
6 agreements at varying ages, 2 campaigns (one sales, one content), shoots at several points
including one with a missing parcel item, posts live / in review / sent back, ~30 sales each
stamped with creator + campaign + post, some confirmed and some inside the return window.

Every row is tagged so it can be removed in one command.

### C · Clearing the decks
- Remove `features/follower-shoppable-reels` and its never-applied migration
  `081_shoppable_reels_foundation.sql`. **Verified 2026-08-20: no `%reel%` table exists in
  production** — the migration was never run and no server code or screen was ever written.
- Correct `release.released` on four contracts that are live and in use:
  `collab-phase0-foundations`, `follower-event-log`, `follower-profile-repairs`,
  `concept-stageb-discover`.
- Rewrite `Docs/TEST_ACCOUNTS.md` — it documents a mock OTP and localhost addresses.
  `otp.service.js` deliberately has no mock path; `OTP_MOCK=true` sits in the production env
  and is ignored by the code.
- Run the device check owed since follower OTA v224: Profile → Saved posts → open a post,
  then delete an address, then edit a name.

## Scope — out

- **No screens.** Nothing renders the two numbers. That is Stage 1 (creator) and Stage 3 (brand).
- **No diary reader.** The history screen is Stage 1.
- **Nothing visible to a real follower.**
- **No second summary endpoint** for the brand.
- **Not opening brands to pitches** — approved by the founder, but it belongs to Stage 1 with
  its own go on the day.

## Login accounts

`users.phone` is `UNIQUE` and `users.role` is single-valued — one phone, one role. Verified
2026-08-20.

| Number | State | Use |
|---|---|---|
| 8639448121 | **Exists** — follower since 2026-04-10 | Practice follower (needed at Stage 6) |
| 8465994979 | Free | One of brand / creator |
| — | **One more needed** | The other of brand / creator |

The other ~21 practice creators never log in; they exist so search returns a realistic result
set. Not blocking: everything except the second login account can be built now.

## Deploy class

**Production-impacting.** `backend/src/**` plus writes to the production database. No migration.
Explicit founder go required before the push, per `feedback-push-is-the-deploy`.

**Safe for phones that have not updated:** yes. The brand summary gains a field and loses none;
the creator endpoint is new and unrequested by any shipped build.
