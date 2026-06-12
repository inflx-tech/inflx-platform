# Workflow — Universal Share Links

1. A follower is on an influencer store / brand store / product / offer.
2. They tap **Share** (or the ↗ icon) → the native share sheet opens with a
   canonical link:
   - influencer → `inflx.in/s/:handle`
   - brand → `inflx.in/b/:brand_id`
   - product → `inflx.in/p/:product_id`
   - offer → `inflx.in/o/:offer_id`
   (+ `cid/sid/iid` when shared from a creator context, so attribution carries.)
3. They send it to anyone (WhatsApp, etc.).
4. The recipient taps it → backend logs the click → 302 to the follower-app
   deep path. With the app's native link handler (APK round) it opens the exact
   screen; until then it resolves via FOLLOWER_APP_URL.

## Edge cases
- No attribution context (organic browse) → link still works, just no creator
  IDs.
- Missing id → builder returns null, share no-ops (never crashes).
