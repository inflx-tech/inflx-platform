# post-links-codes — impact

**Production-impacting.** Migration 196, backend (Render), website (Vercel: three new public pages
`/p`, `/s`, `/c`), phone apps (OTA: influencer and brand). Explicit go required before migrate, push, OTA.

## What changes for people
- **Creators:** approved posts get a code and five links; Share, Where to share what, Store and
  collection links, Stats. The Create tab takes the L1 layout (three cards; each post shows its code).
- **Brands:** a selling set gains **Posts** with codes and numbers, and **Copy all codes**.
- **Anyone tapping a link:** `inflx.in/p/…`, `/s/…`, `/c/…` open a plain INFLX page (no shopping on the
  web; the shopper app comes later). Today no post is approved in production, so no code exists yet.
- **INFLX admin:** a new platform setting, "Link channel window".

## Data
Migration 196 (additive): `creator_posts.post_code` (+ issued time), `creator_collections.link_code`,
`store_handles` + a trigger on `influencers`, `link_visits`, `follower_transactions.link_channel`,
`platform_settings.link_channel_window_days` = 30. Codes are given to any approved new post and every
collection; every current handle is recorded. `scripts/run-196.js` prints the counts and money.

## Privacy
Visits keep no IP address and no identity from the web; a device id only when the shopper app sends one.
Creators and brands never see who bought.

## Money
None moves. Orders through posts arrive with the shopper app.

## Risk
- The old API-host `/s/:handle` and `/p/:id` (product) redirects are untouched; old shared links keep working.
- A handle a creator gives up stays with her in `store_handles`; if another creator later takes it as her
  *current* handle, the current one wins.
