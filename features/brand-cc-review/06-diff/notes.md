# Before / After — A2 review consolidation

**Before:** content review in 3 places — the ⚡ needs-you banner (already removed in A1),
the dedicated `/reviews` route (4.17 kB, its own MediaPreview copy + 2-tab queue), and the
hub's inline Hierarchy review. The hub's Hierarchy also carried two "full review ↗"
cross-links jumping to `/reviews`. `MediaPreview` was copy-pasted (hub + /reviews).

**After:** review is one surface — the hub's inline Hierarchy (Approve / Request revision /
Confirm live · release T2, with MediaPreview, all in place). `/reviews` is retired to a
**redirect** to the hub (now 512 B in the build), so old bookmarks/deep-links don't 404.
`MediaPreview` extracted to shared `reviewParts.js` (one copy). The two cross-links removed.

## Changed
- New `reviewParts.js` (shared MediaPreview).
- `[id]/page.js`: import shared MediaPreview; deleted the inline copy; removed the 2
  `full review ↗` cross-links (inline action buttons untouched).
- `[id]/reviews/page.js`: 445-line queue → redirect to the hub.

## Verification
- **`next build` compiled successfully** (77 pages); `/reviews` shrank 4.17 kB → 512 B
  (redirect stub) — confirms the route is retired.
- **Pending (web verify):** founder on Vercel — review a deliverable from the hub; hitting
  an old `/reviews` URL redirects to the hub.

## Known delta
- No separate focused "Review queue" tab yet (the mockup's fuller Review stage); the inline
  Hierarchy review is the single surface. A later refinement can add a filtered queue view.
