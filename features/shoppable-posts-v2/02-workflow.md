# shoppable-posts-v2 — workflow

Every step names who acts, what the server does, and what they see. D = the set's posting date.

## W1 · She starts a post (P1 → P3)
1. Creator app → **Create** tab (P1). Server (`GET /influencers/me/create`): collaborations still short of
   their minimum before D ("Needs a shoppable post"), her latest posts, her collections, whether she can post.
2. **New shoppable post** → P2 brands (`GET …/shoppable-posts/brands`): brands where she has a signed Pay for
   Sale / Hybrid collaboration on the new terms; one whose shoot isn't done shows "Opens after your shoot plan".
3. Brand → P3 collaborations (`GET …/shoppable-posts/collaborations?brand_id=`): what she can sell, D, posts
   done of the minimum, what she earns. Next → server makes a **draft** (`POST …/shoppable-posts`), refused
   unless signed by both and the shoot is done. ("Start" on P1 jumps here with the collaboration chosen.)

## W2 · Offer post (P4 → P7)
1. P4: offer post or price post (`GET …/:id/options` gives both counts, or the reason one isn't possible).
2. P5: offer types she has, with counts (empty types named as hidden) → one running offer; an offer ending
   within 7 days of D warns. Saved (`PATCH …/:id { offer_id }`); a fixed bundle's products are added for her.
3. P6/P7: products from the offer's live pool with the price shoppers pay; Next waits for the pick count.

## W3 · Price post (P8)
Band (five, INFLX's) and categories filter her products without offers; she picks at least 1.

## W4 · Theme, media, tags, review (P9 → P11)
1. P9: at least 1 theme tag, at most 1 per group.
2. P10: photo or video, single or carousel (≤ 10). Each file: `POST …/:id/upload-url` → the phone PUTs it
   straight to storage (size and type signed) → `PATCH …/:id { media }`; the server checks each file landed,
   its kind, its size, a video's length (≤ 90 s). The music warning sits at the upload.
3. P11a (optional): tap a photo, pick the product → `PATCH { pins }`.
4. P11: caption; the facets worked out by the server (category leaves, the offer, the band of the costliest
   item — discounted for a discount offer — and her theme). **Send to INFLX** → `POST …/:id/submit`:
   every rule re-checked; state In review.

## W5 · INFLX decides (P12, P13)
1. Admin → website Admin → Posts: new posts show collaboration, post type, offer and facets.
2. **Approve** → re-checked (offer still running, products still hers); a stale post is refused with the
   reason. Approved → she's told "It goes live on D"; live from D.
3. **Send back** with a reason → she's told; P13 shows it. She may change media, caption, products and
   tags (`PATCH` refuses anything else) → **Fix and send again**. Or **Start over** (a new draft for the same
   collaboration), or **Delete**.

## W6 · After approval (P14, P15)
- She can **take it down** (Q1) → removed, earnings kept.
- The brand ends the offer (or its end date passes — the daily sweep at 00:10 IST, and reads show it at once)
  → removed "offer ended", she's told; the notice opens P15.
- The brand removes products from the offer / a product goes off sale → they leave her posts; an empty post
  is removed. Every product sold out → removed. A price change → the band recalculates.
- The offer page on the website counts live posts and each creator's posts; the remove-products preview
  says how many posts it touches and empties.

## W7 · Collections (P16 → P20)
Create tab → **New collection** (or "+" → Collection): name + her live posts **or** products (grouped by
collaboration; each remembers its collaboration). Collections list with hidden/live; one collection:
rename, add, remove, delete (posts untouched).
