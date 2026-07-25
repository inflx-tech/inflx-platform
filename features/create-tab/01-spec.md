# Feature Spec — Create tab (influencer app · Wave-1 screen 3)

> Step 2. Promotes Posts from a Home bolt-on to a first-class tab, on the
> Instagram-clean design system.

## Problem / goal
The Post/Concept feature (PostComposer + My Posts) is buried two hops inside Home
via off-system inline-styled tiles (hardcoded `#1A1A1A`/`#F6B11E`, emoji). Give it a
real **Create** tab, restore the 5-tab bar from the mockup, and restyle the posts
ledger to IG-clean.

## Scope
**In scope**
- New `CreateScreen` = the Create tab root: IG-clean header + a "New Post" CTA
  (→ existing `PostComposer`) + the **My Posts ledger** restyled to the IG-clean kit
  (status as dot+label, cover thumb, slides/products meta). Rejected posts show the
  reason + a "Try again" action.
- Add **Create** as the 3rd bottom tab (Home · Collabs · **Create** · Earnings ·
  Profile), MCI plus icon.
- Route ALL Posts entries through the Create tab: repoint `CampaignProducts` "Create
  Post" CTA to the Create tab; `PostComposer` post-submit returns to the Create
  ledger (`replace('CreateMain')`).
- Remove the two Post bolt-on tiles from `HomeScreen` (Create tab owns that entry now).

**Explicitly out of scope (later contracts)**
- Restyling the **PostComposer** 5-step wizard itself (kept functional as-is; its
  IG-clean restyle is a later contract).
- True prefill **edit-and-resubmit** of a rejected post (needs PostComposer edit
  support) — "Try again" opens a fresh composer for now.
- Deleting the now-unused `MyPostsScreen.js` file (later cleanup).
- Any backend/DB change.

## Surfaces touched
- App(s): **mobile (influencer) only.** No web, no backend.
- Roles: influencer.

## Data / contracts
- New/changed tables / migrations: **NONE.**
- New/changed endpoints: **NONE.** Reuses `influencerApi.getMyPosts()`.
- Money/units/attribution/status: none touched.

## Non-functional
- Auth/role gates: influencer as today.
- Failure modes: `getMyPosts` fails → error/empty state; no crash. Existing Posts
  entry points must not dead-end after the move.

## Design reference
`04-preview/mockups/create-tab-ia.html` — the Create tab column (New Post CTA +
My Posts list with status dots + rejected "Edit & resubmit").
