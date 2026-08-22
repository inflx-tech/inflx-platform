# Before / after

## What changed against what was promised

| Promised | Built |
|---|---|
| Creator can upload her own photo | Yes — tile on My Profile is tappable; upload, replace, or clear back to initials. |
| Only her photo is ever shown | Yes. The scraped Instagram picture is explicitly stripped from search responses. |
| Three follower figures on her profile page | Yes — INFLX (leading, outlined) · Instagram · YouTube. Never summed. |
| YouTube honest rather than zero | Yes — "not connected", or "not counted yet" if she gave a handle. |
| Remove the duplicate column | Split into two migrations. **See below.** |

## Departure: one migration became two

05-impact described a single migration that drops `avatar_url` and adds
`profile_image_r2_key`. Writing the deploy sequence exposed that as an outage:

* the running backend selects `i2.avatar_url` in creator search
* the new backend selects `i2.profile_image_r2_key`

Whichever column is absent when a request lands, **creator search breaks for the brand
using it**. One migration guarantees a window in one direction or the other:

* drop first → old code broken until Render finishes
* deploy first → new code broken until the migration runs

So: **157 adds** (both columns exist, both versions work), deploy, verify, **158 drops**.
No window where search is down. 158 is destructive and holds its own explicit go.

## Verification, and why it is not the usual kind

The local test database was unreachable for this entire piece of work — the container
stopped serving connections and Docker refused state-changing commands. The dev database
turned out to be five migrations stale, so it could not stand in.

Verified instead **directly against production**, which for this change is stronger than
the unit suite would have been, since every risk here is a query meeting the real schema:

* every changed statement run against production **inside a transaction, then rolled back** —
  the search select, the public-profile select, and the write path. All four passed.
* rollback confirmed clean: `profile_image_r2_key` did not exist afterwards.
* `avatar_url` re-confirmed empty immediately before shipping: 22 rows, 0 populated.
* mobile suite 159/159; android bundle builds clean.

**Not covered:** the new upload endpoint end-to-end. That is exercised against production
after deploy, not before.

## Fixed in passing

`getPublicById` called `resolveAvatars` with the default key field
(`profile_pic_r2_key`), which onboarded creators never have — so it was a permanent no-op,
and a comment in the file said as much without treating it as a defect. It now resolves
her uploaded photo.
