# Impact — discovery shortlist + invite
**Frontend-only, brand-web (Vercel) — zero backend (all endpoints already exist).**
- influencers/page.js: Shortlist action + group-picker modal (influencerGroupApi).
- influencers/[id]/page.js: placeholder modal → real campaign/set invite.
Risk: moderate — invite is a REAL state change (creates a campaign_influencer). Mitigated:
uses the verified endpoint + required influencer_id, explicit confirm, honest error surfacing,
and it's the same call the campaign wizard already makes.
Release: production-impacting via Vercel → founder go; verified in the founder's E2E pass.
Note: side-by-side compare deferred.
