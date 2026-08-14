# 03 — Expected outputs: follower-profile-repairs

## Database
```
follower_addresses.deleted_at — new nullable column, NULL on every existing row
```

## API

### `GET /v1/follower/posts/saved` (auth required)
```json
{ "success": true, "data": { "posts": [ { "id": "…", "caption": "…",
  "media_kind": "image", "cover_media_id": "…", "saved_at": "…",
  "creator": { "handle": "…", "name": "…", "avatar": "…" } } ] } }
```
Same card shape as the feed. Newest save first. Empty → `{ "posts": [] }`, 200.
No JWT → 401.

### `DELETE /v1/followers/addresses/:id` (auth required)
`{ "success": true, "data": { "deleted": true } }` · not found / not yours /
already deleted → `NOT_FOUND` 404.

### `PATCH /v1/followers/me` (auth required)
Request `{ "name": "Meera", "email": "meera@example.com" }` → the updated
follower object.

| Case | Code | Field | HTTP |
|---|---|---|---|
| name < 2 chars or blank | VALIDATION_ERROR | name | 422 |
| malformed email | VALIDATION_ERROR | email | 422 |
| email already used | VALIDATION_ERROR | email | 422 |
| phone in body | ignored (never updated) | — | 200 |

### `GET /v1/followers/addresses`
Unchanged shape; **soft-deleted rows are absent**.

## Screens
- **Saved Posts** — grid of saved posts, newest first; honest empty state; tap
  opens the post; pull to refresh.
- **Addresses** — each row gains a delete action behind a confirm.
- **Edit Profile** — name + email, inline errors, save/cancel. Phone shown
  read-only with a note that it is the login identity.

## Guarantees
1. Past orders keep resolving their shipping address after a delete.
2. No deleted address appears in the checkout picker.
3. A duplicate email is a field error, never a 500.
4. Guests see no change anywhere — all three surfaces are signed-in only.
