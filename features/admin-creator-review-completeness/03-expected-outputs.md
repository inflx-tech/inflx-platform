# Expected outputs

## `GET /v1/admin/queue/influencers` — each row
| Field | Before | After |
|---|---|---|
| `full_name` | absent | `COALESCE(i.full_name, u.name)` |
| `phone` | present, discarded by the page | present and rendered |
| `city` / `state` | **absent from the query** | `COALESCE(i.city, u.city)` / `COALESCE(i.state, u.state)` |
| `youtube_handle` | **absent from the query** | present |
| `youtube_subscribers`, `youtube_videos`, `youtube_scrape_last_run` | did not exist | present |
| `scrape_last_run` | absent | present — lets the row distinguish 0 from never-measured |
| `email` | absent | present |

## `GET /v1/admin/queue/brands` — each row
`u.city`, `u.state`, `u.email` added. `b.*` never carried city; it lives on `users`.

## `GET /v1/influencers/:id` (onboarded branch)
- `city`, `state`, `full_name` COALESCEd across `influencers` and `users`
- `youtube_channel_id`, `youtube_title`, `youtube_subscribers`, `youtube_views`,
  `youtube_videos`, `youtube_thumbnail_url`, `youtube_scrape_last_run`
- `youtube_url`, `instagram_url` — server-resolved links, so no caller re-implements
  handle parsing
- **unchanged:** phone / wallet / pending / TDS stay inside the `role === 'admin'` block.
  A brand calls this endpoint too and must not receive them.

## `GET /v1/influencers/:id` (scraped branch)
`youtube_url` + `instagram_url` only. `creator_profiles` has no YouTube statistics and none
are invented for it.

## `POST /v1/influencers/:id/rescrape`
```
{ influencer: {...}, scraped_at: "...",
  youtube: { attempted: true, configured: bool, found: bool, reason?: string } | null }
```
`youtube` is `null` when she has no channel — a different fact from "we tried and failed".
A YouTube failure never rolls back or throws away the Instagram refresh in the same call.

## `GET /v1/admin/influencers` (list)
`full_name` / `city` / `state` COALESCEd; `youtube_subscribers` +
`youtube_scrape_last_run` added; search now also matches `youtube_handle` and
`COALESCE(i.city, u.city)`.

## Screens
| Screen | Must show |
|---|---|
| Approvals → Influencers row | name · phone · where · niche · Instagram (link) · Instagram reach · YouTube (link) · YouTube reach |
| Approvals → Brands row | contact · phone · where · GST · address · pincode · category · email |
| Creator record | name in the header · both handles as working links · 6 reach tiles (Instagram, eng. rate, YouTube, INFLX, wallet, status) · "What she supplied at signup" · "Platform record" |
| Influencers list | new YouTube column · City filled in · YouTube handle under the Instagram handle |

## The rule every screen obeys
Three renderings, never conflated:
- **no channel / no value on file** → `--` or "Not given"
- **on file, never measured** → "Never checked" (italic, muted)
- **measured** → the number

A confident `0` where nothing was measured is the defect this contract exists to remove.
