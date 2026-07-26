# Impact (B2)

**One-line verdict: purely additive — one new table, new endpoints, one new
admin page; nothing existing is touched, and mobile is untouched (no OTA).**

- Migration 145 additive; singleton indexes make global/business layouts
  unique and creator layouts one-per-influencer.
- Resolver is read-only over existing tables (concepts/collections/
  creator_posts/post_media/influencers/brands); reuses the exact
  Inspector visibility definition — one counting truth.
- Admin page rides existing auth (sections capability) + existing
  Inspector endpoint for the picker.
- Rules honesty: 'area' needs a city (else popularity), 'following' needs
  auth (else popularity) — the payload always renders.
- Deploy: production-impacting (backend on push, brand-web on Vercel);
  zero effect on the running apps until B3 consumes the endpoint.
