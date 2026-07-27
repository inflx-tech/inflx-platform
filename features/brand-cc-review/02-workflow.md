# Workflow — A2 review consolidation
## Actor
Brand, campaign with submitted/approved deliverables.
## Steps
1. In the hub Hierarchy, a submitted deliverable shows MediaPreview + Approve / Request
   revision inline; an approved+live one shows Confirm live · release T2 — all in place.
2. Visiting the old `/dashboard/campaigns/:id/reviews` (bookmark / old link) → redirected
   to the hub. No separate review screen exists.
3. No "full review ↗" cross-link remains (the actions are inline).
## Success
- Review happens in exactly one place (the hub); `/reviews` redirects; one shared
  MediaPreview; review/confirm actions still work.
## Failure/edge
- Old `/reviews?tab=live` link → redirect to hub, no 404.
