# Workflow prediction — Phase 2.5b

**No new visual design → no new HTML mockups.** Per founder decision 2026-06-15, the only
screen that would change visually (FindScreen) is DEFERRED to the Phase 5 visual rebuild.
The in-scope changes are:

- **Brand signup**: dropdown option "Fashion & Apparel" is unchanged on screen; only the
  saved value flips `fashion_walkin` → `fashion`. No pixel change.
- **Food tile**: now renders the EXISTING restaurant/dining layout (already shipped for
  the Eat path) instead of the product-grid layout. Reference = the current dining layout.
- **Offline fallback grid**: shows the 5 launch tiles instead of the old 7 — only visible
  if the categories API is unreachable.

Predicted user-visible outcome: the Food tile looks like the existing restaurant browse;
everything else is unchanged. Before/after captured in words in `06-diff/notes.md`.
mockup_locked reflects the founder's scope approval that there is no new design to author.
