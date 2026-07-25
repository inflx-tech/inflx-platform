# Impact — Create tab

## One-line verdict
**Frontend-only, mobile-influencer, OTA — zero backend/DB.**

## What changes
- Adds `CreateScreen` + a `postStatusMeta` helper.
- `InfluencerNavigator`: adds the Create tab + Create stack (CreateMain + PostComposer);
  moves PostComposer out of HomeStack into the Create stack.
- `HomeScreen`: removes the two Post bolt-on tiles.
- `CampaignProductsScreen`: "Create Post" CTA → Create tab.
- `PostComposerScreen`: post-submit `replace('MyPosts')` → `replace('CreateMain')`.

## Blast radius
- No API added/changed; reuses `getMyPosts`.
- No native modules → **OTA only, no APK rebuild.**
- `MyPostsScreen.js` becomes unused (left in place; deleted in a later cleanup).

## Risks & mitigations
- **Posts entry-point breakage** after moving PostComposer between stacks — mitigated by
  repointing every caller to the Create tab + a smoke/Maestro check of New Post.
- Composer return path — `replace('CreateMain')` resolves within the Create stack.

## Release classification
**Production-impacting via OTA** → surfaced for explicit founder go; build/commit
deploy-inert until publish. Maestro skippable on founder call (recorded).
