# 01 — Spec: follower-profile-repairs (Slice 1)

**Program:** Follower posts/feed/stats program (chat session 2026-08-14).
**Slice:** 1 of 6 — fix what is provably broken in Profile today.
**Class:** production-impacting (migration + `backend/src/**` + `Packages/Mobile/src/**`).
**UI-governed:** yes → mockups + before/after diff required.

---

## The three faults (all verified in live code, 2026-08-14)

### Fault 1 — a saved post can never be found again

`MeScreen` row **"Saved posts"** navigates to `SavedList` → `SavedScreen`,
which loads `GET /follower/saved` — the **legacy saved-offers** list (offer
types, BOGO/BULK labels, restaurant deals). Meanwhile `post_saves` (mig 141) is
being written by `POST /follower/posts/:id/save`, and **no screen anywhere
reads it back**. A follower saves a post and it is gone.

**Fix:** a real Saved Posts screen backed by `post_saves`, and a new endpoint
to read it. The legacy offers screen stays on disk, unreferenced (zero-baggage
rule — cleanup is a separate contract).

### Fault 2 — an address cannot be deleted

`follower.routes.js` has POST / GET / PATCH on `/followers/addresses`. There is
**no DELETE**. A follower who moves house carries the old address forever.

**Fix must be a soft delete.** `follower_orders.address_id` references
`follower_addresses(id)`, so a hard delete either fails on the FK or destroys
the shipping address of a past order. Add `deleted_at`; hide deleted rows from
the list; order history keeps pointing at the row it shipped to.

Guard: deleting the **default** address clears/reassigns `followers.default_address_id`.

### Fault 3 — "Edit" does nothing, on either side

`MeScreen`'s Edit button raises `Alert("Coming with the account settings
slice")`. The mobile API client declares `updateMe → PATCH /followers/me`, but
**that route does not exist**. Brand, influencer and agency all have `PATCH
/me`; follower is the only role without one.

Note the data actually lives on `users` (`name`, `email`, `city`) — the
`followers` table holds only `id`, `user_id`, `default_address_id`.

**Fix:** build `PATCH /followers/me` (name, email) and a real edit screen.

---

## In scope

### Schema — migration 151
- `follower_addresses.deleted_at timestamptz NULL`
- partial index on live rows

### Backend
- `GET  /v1/follower/posts/saved` — the signed-in follower's saved posts,
  newest save first, same card shape the feed already returns so the mobile
  card component is reused, not rewritten.
- `DELETE /v1/followers/addresses/:id` — soft delete + default reassignment.
  404 if not theirs. Idempotent: deleting an already-deleted address → 404.
- `PATCH /v1/followers/me` — updates `users.name`, `users.email`.
  - name: required if present, 2–100 chars, trimmed
  - email: optional, valid, **unique** — a taken email → `VALIDATION_ERROR`
    with `field: "email"`, never a raw 23505
  - phone is **not** editable here (it is the login identity)
- `GET /v1/followers/addresses` filters out soft-deleted rows.

### Mobile
- New `SavedPostsScreen`; Profile's "Saved posts" row points at it. Empty state
  is honest: "Posts you save will appear here."
- Address list rows get a delete action with a confirm dialog.
- New `EditProfileScreen`: name + email, save/cancel, inline field errors;
  replaces the Alert.

## Out of scope
Notifications · help & support · payment methods · language/settings · reviews
surface · legal links · delete account · avatar upload / follower identity ·
the full Profile redesign. Those come after slices 2–3, when comments and
sharing have defined what a follower's identity needs to be.

## Expected end state
A follower saves a post and finds it in Profile. Deletes an old address and it
is gone from the list while last year's order still shows where it shipped.
Corrects a mistyped name and it sticks.

## Risks
- **Soft delete leaking:** every read path for addresses must filter
  `deleted_at IS NULL`, or deleted addresses reappear at checkout. Verified by
  test, not by reading.
- **Email uniqueness:** `users.email` is UNIQUE — must be caught and returned
  as a field error, not a 500.
