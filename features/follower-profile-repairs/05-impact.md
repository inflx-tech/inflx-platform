# 05 — Impact: follower-profile-repairs

**Verdict: repairs only — three dead paths become live; nothing that works
today changes behaviour.**

## Why
- **Saved posts:** a new endpoint and a new screen. The one edit to existing
  code is a single `navigate('SavedList')` → `navigate('SavedPosts')`. The
  legacy saved-offers screen is left intact and unreferenced.
- **Address delete:** additive column + new route. The risk is read paths that
  forget the `deleted_at IS NULL` filter — every address read path is changed
  together and covered by test, and order history deliberately keeps resolving
  deleted rows.
- **Edit profile:** a route that does not exist today cannot regress. It writes
  `users.name` / `users.email` for the calling follower only.

## Money / attribution
Untouched. No pricing, commission, escrow, order or wallet code is in this
contract's path.

## Deploy class
**Production-impacting.** Migration 151 + Render backend + follower OTA.
Explicit founder go required before push.
