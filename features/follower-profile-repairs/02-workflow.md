# 02 — Workflow: follower-profile-repairs

## Workflow A — a saved post is findable
1. Meera taps the bookmark on a post in the feed → `POST /follower/posts/:id/save`.
2. Profile → **Saved posts**.
3. The post is there, newest first, with creator and cover image.
4. She taps it → the post opens.
5. She unsaves it → it leaves the list on next focus.
6. A follower who has saved nothing sees "Posts you save will appear here." —
   not a spinner, not an error.

## Workflow B — an address can be removed
1. Profile → Addresses. Three addresses; the old flat is one of them.
2. Delete → confirm.
3. It disappears from the list and from the checkout picker.
4. Her order from last year still shows the old flat as its shipping address.
5. If the deleted one was the default, another becomes default (or none, with
   no crash at checkout).

## Workflow C — the name can be corrected
1. Profile → Edit.
2. "Mera" → "Meera", save.
3. The header shows Meera immediately; reopening the app still shows Meera.
4. Entering an email already used by another account shows an inline
   "already in use" under the field — not a crash, not a silent failure.

## Build order

| # | Step | Path |
|---|---|---|
| 1 | Migration 151 — `follower_addresses.deleted_at` + runner | `backend/migrations/151_*.sql`, `backend/scripts/run-151.js` |
| 2 | `GET /follower/posts/saved` | `followerPosts.service.js` + controller + route |
| 3 | `DELETE /followers/addresses/:id` (soft) + filter reads | `follower.controller.js`, `follower.routes.js` |
| 4 | `PATCH /followers/me` | `follower.controller.js`, `follower.routes.js` |
| 5 | Mockups + lock | `04-preview/mockups/*.html` |
| 6 | `SavedPostsScreen` + Profile row rewire | `screens/follower/`, `FollowerNavigator.js` |
| 7 | Address delete UI | `AddressScreen.js` |
| 8 | `EditProfileScreen` | `screens/follower/` |
| 9 | Contract tests | `qa/features/follower-profile-repairs/` |
| 10 | Before/after diff notes | `06-diff/notes.md` |

## Verification
- **API:** save 2 posts → `GET /follower/posts/saved` returns exactly those 2,
  newest first. Unsave 1 → returns 1.
- **API:** saved-posts as a guest → 401 (it is personal data).
- **API:** DELETE an address → gone from `GET /addresses`; the row still exists
  with `deleted_at` set; the past order still resolves its address.
- **API:** DELETE someone else's address → 404 (never 403 — don't confirm it exists).
- **API:** DELETE the default address → `followers.default_address_id` no longer
  points at a deleted row.
- **API:** PATCH name → `GET /followers/me` reflects it. PATCH a duplicate
  email → 422 with `field:"email"`. PATCH an empty name → 422.
- **Mobile:** the three workflows above, on device.

## Rollback
Point the Profile row back at `SavedList`; drop the DELETE/PATCH routes; the
`deleted_at` column is inert if unread.
