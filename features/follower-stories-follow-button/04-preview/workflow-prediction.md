# Workflow Prediction — follower-stories-follow-button

## Design source
Founder request (2026-06-08). The Home Stories carousel gains a social-discovery
affordance for logged-in followers: a small **+ Follow** button under each circle
the follower doesn't yet follow (becomes **Following** on tap). Visual language =
the creator-vibe brown pill (matches CTAs). Consistent with the round gradient-ring
story circles already shipped.

## What the reviewer should see
- Logged-in: followed creators first, then popular; **+ Follow** under non-followed,
  **Following** under followed. Anonymous: no buttons.

## Honest notes
- Sub-set + ranking + location come from the existing `creators_listing` rule
  (real follow-graph, real follower counts, follower's profile city).
- Optimistic follow; failed API call silently won't persist (no fake state).
- "Popular with top offers" enrichment depends on the Phase-3 offer-source fix.

## After-capture
Maestro/APK screenshot of Home Stories (founder-side), per `home.maestro-flow.json`.
