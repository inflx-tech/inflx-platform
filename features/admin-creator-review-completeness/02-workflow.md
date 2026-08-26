# Workflow — admin reviews a newly registered creator

## Actors
- **Creator** — signs up in the mobile app, supplies five facts, waits.
- **Admin** — the founder, deciding approve / reject from `admin.inflx.in`.

## The flow, end to end

1. Creator completes OTP. `users` row exists with a placeholder name.
2. Creator fills `InfluencerRegisterScreen`: full name (required), city (optional),
   Instagram handle (required), YouTube channel (optional).
3. `POST /v1/influencers/register`
   - writes name + city to `users`
   - **[new]** writes `full_name` + `city` to `influencers` as well
   - writes both handles to `influencers`
   - fires the Instagram scrape, non-blocking
   - **[new]** fires the YouTube channel fetch, non-blocking, only if a channel was given
4. `users.status = 'pending'`. She appears in the admin approvals queue.
5. Admin opens **Approvals → Influencers**. `GET /v1/admin/queue/influencers`
   - **[new]** returns name, city/state, YouTube handle, YouTube subscribers,
     both last-checked timestamps — all COALESCEd across `influencers` and `users`
6. The row shows all five supplied facts plus both reach figures. Fields the creator left
   blank say so in words. Figures nobody has measured say "Never checked".
7. Admin decides on the row, **or** opens **Full record** for the whole picture:
   `GET /v1/influencers/:id`
   - **[new]** `city`/`state`/`full_name` COALESCEd, YouTube columns, `youtube_url`
     and `instagram_url` as openable links
8. On the record, **Refresh** re-checks Instagram **and** — if she gave a channel —
   YouTube, in one click. `POST /v1/influencers/:id/rescrape`
   - **[new]** the response reports what happened to the YouTube half separately, so the
     screen can say "no API key" / "channel not found" instead of silently doing nothing
   - the page re-reads the record afterwards rather than trusting the rescrape payload
9. Approve → `PATCH /v1/admin/influencers/:id/status` → she is in.

## Failure paths that must not degrade
- **No `APIFY_TOKEN` on the server.** Every YouTube figure stays NULL, every screen says
  "Never checked", and the Refresh toast says the token is missing. Registration and
  approval are unaffected.
- **The actor returns a shape with no channel totals.** Subscribers/views/videos are NULL
  and the record says the check ran but sent back no figures — never 0.
- **YouTube channel not found / typo'd.** Same as above, with the reason reported. The
  Instagram refresh in the same click still commits.
- **Channel hides its subscriber count.** `subscribers` is NULL and the screen says
  "Hidden" — distinct from "Never checked" and from a real 0.
- **Creator registered before 2026-08-26.** `influencers.city`/`full_name` are NULL for
  her; every read COALESCEs to the `users` row, so her record is complete without a
  backfill migration.
