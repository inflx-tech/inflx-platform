# Workflow Definition — Create tab

## Actor
Logged-in influencer, approved.

## Preconditions
Influencer with 0..N posts across statuses (submitted/approved/rejected/draft).

## Workflow steps (user-observable)
1. Open the app → bottom bar shows 5 tabs: Home · Collabs · **Create** · Earnings ·
   Profile.
2. Tap Create → `CreateScreen`: IG-clean header + a "New Post" CTA + "My Posts" list.
3. Each post row shows cover, concept/collection name, slides/products meta, and a
   status dot+label (In review / Live / Rejected / Draft). A rejected row shows its
   reason + "Try again".
4. Tap "New Post" (or empty-state CTA, or "Try again") → opens `PostComposer`.
5. Complete + submit a post in PostComposer → returns to the **Create** ledger, which
   shows the new post as "In review".
6. The Home screen no longer shows the old Post/My-Posts tiles; the "Create Post with
   these products" CTA on CampaignProducts opens the Create tab's composer.

## Success definition
- A Create tab exists and is the single home for Posts; the ledger renders IG-clean
  with correct per-status styling; New Post / Try again open the composer; submitting a
  post lands back on the Create ledger; and no prior Posts entry point dead-ends.

## Failure / edge workflows
- `getMyPosts` fails → error/empty state, no crash.
- No posts → empty state with a "Create your first post" CTA.
