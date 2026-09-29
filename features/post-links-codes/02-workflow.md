# post-links-codes — workflow

## W1 · A post gets its code (approval)
INFLX approves a post (website Admin → Posts) → the server gives it a 6-character code
(`creator_posts.post_code`) in the same step and tells her. Drafts and posts in review have none.

## W2 · She shares it (L1 → L4)
1. Create tab (L1): each approved or live post shows "Code K7M2F9"; **Share** from approval, **Stats** once live.
2. Share (L2/L3, `GET /influencers/me/shoppable-posts/:id/share`): the code (Copy), the caption line
   (Copy), five links `https://inflx.in/p/<code>/<ig|yt|wa|fb|o>` (Copy, or tap for the Share sheet).
   Before the posting date a banner says the links work from that day. "Follower view" opens the link.
3. Where to share what (L4): the guide, with her own link or line in each place.

## W3 · Someone taps a link
1. `inflx.in/p/<code>/<ch>` (website) asks `GET /v1/links/p/<code>?ch=` with the visitor's browser and
   referrer. The server records a visit (not for link previews/crawlers) and answers what the post is:
   live → the post page; before its date → "goes live on …" + her store; removed / unknown → "no longer
   available" / "couldn't find" + her store.
2. `inflx.in/s/<handle>/<ch>` → her store (current or an old handle); `inflx.in/c/<code>` → the collection
   (or "empty right now" + her store).
3. The shopper app (later) asks `GET /v1/links/code/<code>` when a code is typed: a "Post code" visit.

## W4 · She sees what her links brought in (L5, L6)
- Store and collection links (L5, `GET /influencers/me/links`): store link per channel with this month's
  visits; each collection's link with its visits.
- Stats (L6, `GET …/:id/stats`): visits, orders, sales, her commission; visits by channel; orders by
  channel ("In INFLX" when no tap came first). Never who bought.

## W5 · The brand (L7, L8)
Brand app → a selling set → **Posts** (`GET /campaigns/:id/sets/:sid/posts`): approved and live posts
with code, creator and numbers; the set so far. **Copy all codes** copies the live list and offers
Share. Tapping a post opens its channel breakdown (`…/posts/:postId/stats`).

## W6 · INFLX
Admin → Platform settings → "Link channel window" (30 days, 1–90): stamped on each tap.
