# Her photo, and where her audience actually is

Two items the founder raised on 2026-08-22 that I reported as "next" and then did not
finish before moving on. This contract closes both.

## Item 1 — the photo rule had no way to be obeyed

Founder: *"dont add scraped one as pic. let creator upload it in profile then only that
particular pic should come."*

The restriction shipped. **The upload did not.** So every creator was permanently initials
with no path for that to ever change — not "not yet", but never. I described that as
intended behaviour, which it was not.

Now: the avatar tile on her own profile is tappable — ask for a short-lived link, put the
file straight into storage, save the key. Same three-step shape the rest of the app
already uses. She can also clear it back to initials.

## The duplicate column I created, and removed

Migration 156 (yesterday) added `influencers.avatar_url` for "the picture the creator
uploads". That column was **redundant the moment it was created** — `influencers` already
had `profile_image_url`, described in the public-profile controller as exactly that:
*"onboarded influencers upload their own image"*.

Verified on production before acting: 22 influencers, `profile_image_url` populated on
**0**, `avatar_url` populated on **0**. Neither holds data.

Migration 157 drops `avatar_url` and adds `profile_image_r2_key`, mirroring the existing
scraped pair (`profile_pic_url` + `profile_pic_r2_key`). One way to hold a picture, not
two competing ones. **Storing the key, not a URL** — presigned links expire, so a stored
URL would hand every creator a photo that stops loading in a few hours.

## Item 2 — one follower number where three were asked for

Founder: *"if i click on that creator it should display their data like their followers in
social medias (currently only insta and youtube) and inflx following."*

The **list** showed INFLX following. The **profile page you land on** — the screen actually
asked about — still showed a single "Followers".

Now three separate figures:

| | Source | Shown as |
|---|---|---|
| **INFLX** | counted live from the follow table | leads, "can buy here" |
| **Instagram** | scraped follower count | her handle |
| **YouTube** | nothing exists | "not connected" / "not counted yet" |

**Never summed.** Adding them would invent an audience that does not exist — the same
person can be in two of them. INFLX leads because Instagram reach is who might *see* a
post; INFLX following is who can *buy* without leaving.

**YouTube stays honest.** No subscriber count exists anywhere on this platform, so a number
would be invented. Saying "not connected" beats a confident zero. Scraping it remains its
own piece of work, as agreed.

## Out of scope

* YouTube subscriber scraping — needs a column, a fetch path and a refresh.
* Cropping. She gets what she picked, downscaled to 1200px.
* Brand web.
