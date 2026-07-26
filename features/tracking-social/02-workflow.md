# Workflow Definition — Tracking (social half)

## Actor
Logged-in influencer, approved, with a collab that has ≥1 live deliverable.

## Preconditions
A collab in the tracking/active/completed stage; some deliverables live with social stats.

## Workflow steps (user-observable)
1. From CollabDetail, open **Tracking** (tracking-stage hero, or the "Performance" section
   card) → CollabTrackingScreen.
2. The **On social media** panel shows aggregate reach + likes/comments/saves/shares/
   impressions and average engagement-rate across the collab's live posts, with a per-post
   breakdown list.
3. Tap **Refresh** → re-scrapes each live deliverable's stats and re-aggregates.
4. The **On INFLX** panel is shown as "Coming soon" (Phase 2) — no numbers implied as real.
5. If the collab has no live deliverables yet → an empty "No live posts yet" state.

## Success definition
- The screen renders a correct social aggregate (sum of counts, averaged ER) over the
  collab's live deliverables + a per-post breakdown; Refresh updates it; the platform panel
  is clearly a Phase-2 placeholder with no fabricated data.

## Failure / edge workflows
- A per-deliverable stats fetch fails → that post is skipped; aggregate still renders.
- No live deliverables → empty state, no crash.
