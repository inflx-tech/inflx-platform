# Expected outputs

- Orders: filters map to GET /brands/me/transactions params (type/status/page);
  expanded card shows gross, discount, net, brand_net, commission, via-creator,
  coupon, payment id; load-more appends page 2.
- Bookings: pending booking shows Confirm/Reject; confirm → POST …/confirm →
  row leaves pending tab; stats strip mirrors web numbers.
- Meals: non-restaurant brand sees the "for restaurants only" state (no API
  hammering); restaurant sees dashboard stats + orders; deliver → POST
  /meals/orders/:id/deliver → status updates; suggested rule "Make it live" →
  PATCH status=active.
- Offers: counts in tabs match GET counts; create discount (pct 20) →
  201 → appears in Draft (or Active when "Save & activate"); publish-to-store
  toggle PATCHes published_to_store; attachments sheet lists campaigns.
- Settings: plan/usage render from GET subscription; paid invoice opens PDF in
  browser (download_token); payout connect → POST → status flips to
  created/activated.
- Analytics: tier/city filters re-query; leaderboard tap opens
  BrandInfluencerProfile for linked creators.
- esbuild parse-check clean on all touched files; pnpm qa stays GREEN
  (mobile-only change); existing screens untouched except Home quick actions.
