# Impact Analysis — Influencer Groups (F-5)

> Terse verdict: new brand-scoped groups store + UI; wizard swapped from localStorage to server.
> Additive migration. Reviewer clean (one import bug found + fixed); QA GREEN.

## Affected files
- backend: migrations/123_influencer_groups.sql (NEW); controllers/influencerGroup.controller.js (NEW);
  routes/influencerGroup.routes.js (NEW); routes/index.js (mount /brands/me).
- web: lib/api.js (influencerGroupApi.*); app/dashboard/influencers/page.js (Groups sub-tab + GroupsManager);
  app/dashboard/campaigns/new/page.js (localStorage groups → server).
- mobile: none.

## Affected routes / APIs
| Method | Path | Change |
|---|---|---|
| GET/POST | /brands/me/influencer-groups | list / create (brand-scoped) |
| PATCH/DELETE | /brands/me/influencer-groups/:id | rename / delete |
| POST | /brands/me/influencer-groups/:id/members | add members |
| DELETE | /brands/me/influencer-groups/:id/members/:influencerId | remove member |

## Affected workflows (regression surface)
- Campaign wizard (add-group-to-set) — behavior preserved, now server-backed. Influencers tab
  Discover/Proposals — untouched (Groups is an added sub-tab). pnpm qa GREEN.

## Migration / deploy / OTA impact
- Migration 123 (additive: 2 tables + index) MUST be applied to prod before/with code. Backend + web → push. No OTA.

## Risk notes
- Security verified: brand-ownership enforced on every op; member ids validated; SQL parameterized;
  route not shadowed. No cross-brand access.
- Reviewer found + I fixed: useRef missing import in influencers/page.js (would have crashed the
  create-group modal). Now imported.
- Edge (accepted): groups uncapped in size; wizard uses last-fetched group snapshot (single-user, low risk).
