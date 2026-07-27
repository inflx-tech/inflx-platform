# Feature Spec — Brand CC: Review consolidation (A2)

> Step 2. Second brand-web CC contract. Collapses content review from 3 surfaces
> to 1 and de-duplicates the copy-pasted MediaPreview.

## Problem / goal
Content review lived in **3 places**: the ⚡ needs-you banner (removed in A1), the
dedicated `/reviews` route, and the hub's inline Hierarchy review. `MediaPreview` was
copy-pasted between `/reviews` and the hub. Consolidate to **one** surface — the hub's
inline Hierarchy review (approve / request-revision / confirm-live already live there via
`inlineReview`/`inlineConfirmLive`) — and share MediaPreview.

## Scope
**In scope**
- New shared `reviewParts.js` exporting `MediaPreview`; hub imports it (delete the hub's
  inline copy). 
- **Retire the `/reviews` route** → replace `reviews/page.js` with a redirect to the hub
  (`/dashboard/campaigns/[id]`), so bookmarks/old deep-links don't 404. (Kills its
  MediaPreview copy too.)
- Remove the two now-pointless "full review ↗" cross-links in the Hierarchy tree (the
  inline Approve / Request-revision / Confirm-live buttons remain right there).

**Explicitly out of scope**
- A separate focused "Review queue" tab (the mockup's fuller Review stage) — future
  refinement; the inline Hierarchy review is the single surface for now.
- Contract-signing unification (A3), sets/escrow folding (A4), influencers split (A5).
- Backend (none).

## Surfaces touched
- App: brand-web only. Roles: brand.

## Data / contracts
- Endpoints: unchanged (deliverableApi.review/confirmLive/getMediaUrl already used inline).

## Non-functional
- Review actions unchanged (reuse existing inline handlers); redirect preserves old links.

## Design reference
`04-preview/mockups/command-center.html` — Review lives in the hub, not a separate route.
