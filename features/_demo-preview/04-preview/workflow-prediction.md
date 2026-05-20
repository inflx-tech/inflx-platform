# Workflow prediction — follower public deal browse (Q1)

Worked example for the preview-machinery. Models the actual Q1 fix
that shipped in commit `bfcd788`.

## Trigger

A user opens the INFLX follower app (web or mobile) **without
being signed in**. Today, before Q1, the screen 500'd or asked
for authentication. After Q1, the user lands directly on a
location-based feed.

## Steps

1. App requests `GET /v1/follower/feed?city=<city>` with **no**
   `Authorization` header.
2. `authenticateOptional` middleware allows the request through;
   `req.user` is `undefined`.
3. `follower.controller.js#getFeed` (lines 299–305):
   - resolves `follower = req.user?.sub ? await getFollowerByUserId(...) : null`
     (no DB hit when unauthenticated)
   - resolves `city = follower?.user_city || req.query.city || null`
   - calls `followerService.getFeed(follower?.id || null, city)`
4. `followerService.getFeed` (null-safe for null `followerId`)
   returns a city-based list of currently-live offers, plus an
   empty `followed_influencers_offers` array.
5. App renders the feed; bottom CTA: "Sign in to save & buy".
6. On any purchase / book / enquire action → app navigates to sign-in.

## End state

- HTTP `200 OK` (not `401`, not `500`).
- Response shape: `{ success: true, data: { items: [...], meta: { city, total } } }`.
- No DB write. No follower row created.
- App displays feed; user can scroll, tap deals to see detail.
- User is NOT signed in; localStorage has no `inflx_token`.

## Edge cases

- **No city in query and not signed in** → `city = null`; feed is
  empty (`items: []`), with a "Pick a city" CTA in the UI.
- **Signed in (existing flow)** → `follower` resolves;
  `city = follower.user_city` (their saved city) overrides any
  `?city` query; feed includes followed influencers' offers
  (personalised). Semantically unchanged from pre-Q1.
- **Invalid city** (e.g., `?city=Atlantis`) → feed is empty; no
  error. UI shows "No deals in Atlantis yet."
- **Network failure** (RN side) → app shows offline state; falls
  back to last cached feed.

## What changes vs current behaviour (pre-Q1)

- Today: `GET /v1/follower/feed` with no auth → `500` (the carved
  defect `backend-defect-follower-feed-noauth-500`). The catching
  test asserted `401`, which was the wrong contract per founder's
  product intent.
- After: `GET /v1/follower/feed?city=...` with no auth → `200` +
  location-based feed. The carved test was realigned to the
  founder-confirmed product contract (anon → public, location-
  based) and now passes via the BACKEND fix (no test edit hiding
  a real bug).

## Blast radius

- **Production-impacting:** YES — `backend/src/controllers/follower.controller.js`
  is a governed path. Shipped 2026-05-19 in commit `bfcd788`.
- **Render:** auto-redeploys backend on push.
- **Vercel:** no web change; rebuilds are no-op.
- **OTA:** none required (Mobile may benefit from the new behavior
  but the screen will refresh naturally via the API; the existing
  RN code already handles 200/empty cases).
- **DB:** no migration. No data change.
- **Rollback:** revert the 7-line controller change; reverts cleanly
  (the carved test will go RED again, which is the truthful state).

## Open questions

None at lock time — founder confirmed the product contract
("follower no need authentication for entering and browsing … if
takes any action like purchase then system ask for signin")
on 2026-05-19; mockup-locked under that decision.
