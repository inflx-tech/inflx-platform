# Impact

## Verdict
**Production-impacting.** Backend runtime SQL + a migration + two admin pages.
Nothing mobile — `Packages/Mobile/**` is untouched, so no OTA and no Maestro gate.

## What deploys where
| Target | Trigger | Contents |
|---|---|---|
| Render (backend) | `git push origin main` | `influencer.controller.js`, `admin.controller.js`, `youtube.service.js`, `config/env.js` |
| Vercel (brand-web / admin) | same push | approvals page, creator record page, influencers list |
| Postgres | **manual** `node backend/scripts/run-160.js` | 8 nullable columns on `influencers` |
| OTA | — | not triggered |

## Order matters
**Migration 160 runs BEFORE the push.** Every new read path selects
`i.youtube_subscribers` and friends. If the code reaches Render before the columns exist,
the admin queue, the creator record and the influencers list all 500 —
`column "youtube_subscribers" does not exist`. That is three admin screens down, not one.

The migration itself is safe in isolation: eight nullable columns, no default, no
constraint, no backfill. Applying it and never pushing changes nothing.

## Regression surface
| Path | Risk | Why it is contained |
|---|---|---|
| `POST /influencers/register` | **medium** — the INSERT gained two columns | `full_name` and `city` both already existed (migration 003). `city` is `NULLIF($5,'')` so an empty box stores NULL, matching today. The YouTube fetch is fire-and-forget and cannot fail a signup. |
| `GET /influencers/:id` | **low** | Additive columns plus three COALESCEs. **This endpoint also serves brands** — the privacy line is unchanged: phone, wallet, pending and TDS stay inside `req.user.role === 'admin'`. YouTube reach sits outside it deliberately, because Instagram follower count already does; it is audience size, not personal data. |
| `POST /influencers/:id/rescrape` | **low** | Instagram half untouched and commits first. YouTube is wrapped in try/catch and degrades to a reported reason. |
| `GET /admin/queue/*`, `GET /admin/influencers` | **low** | Additive selects and COALESCEs. No WHERE narrowed. The search WHERE **widened** (youtube_handle, users.city) — it can only return more, never fewer. |
| `v_searchable_creators` | **none** | Not touched. It already COALESCEd city since migration 146; this contract brings the admin paths up to that standard. |
| Brand-facing creator profile | **low** | Gains `youtube_url` / `instagram_url` / YouTube stats. Nothing removed, nothing renamed. |

## Cost
**One Apify actor run per creator checked**, on the existing `APIFY_TOKEN` — the same
billing line the Instagram scrape already sits on. The call asks for `maxResults: 1`
because every actor in this family attaches the channel totals to each video row, so one
result reads the whole channel; asking for more would cost more for nothing. YouTube is
checked at signup and on Refresh only — never on a page load, never on a cron.

## Rollback
- Code: revert the commit; push. Render + Vercel redeploy.
- Migration: **do not roll back.** Eight nullable columns with no reader after a revert are
  inert. Dropping them is riskier than leaving them.
- Config: `APIFY_YOUTUBE_ACTOR` selects the actor and defaults to `streamers~youtube-scraper`
  when unset. Swapping actors is an env change plus a restart, not a deploy. With
  `APIFY_MOCK=true` or no token, YouTube measurement is off and every screen falls back to
  "Never checked".

## Deliberately not done
- **No backfill of `influencers.city` / `full_name`.** The COALESCE reads make existing
  rows correct without touching a single row of production data.
- **No YouTube post-level engagement.** The per-post equivalent of `scrapePostEngagement`
  is a separate contract.
- **Instagram and YouTube reach are never summed.** Two audiences, two numbers.

## Owed
- `backend/tests/admin-creator-review.test.js` — written, **not run**. The test DB has been
  unreachable since 2026-08-24 (`admin-account-review` records the same block).
- There is still no practice admin account, so no admin screen can be exercised
  automatically. This is now the fourth contract to record that gap.
