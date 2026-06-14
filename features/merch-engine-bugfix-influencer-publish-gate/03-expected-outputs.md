# 03-expected-outputs

| State | Before | After |
|---|---|---|
| Allocated product, no note | "Pending"; "+ ADD NOTE & PUBLISH"; no LIVE badge | LIVE badge; "+ ADD RECOMMENDATION" |
| Save a note | "Published — now live on your store" | "Recommendation saved — your note now shows with X" (product was already live) |
| Product with a note | LIVE badge; EDIT / REMOVE FROM STORE | LIVE badge; EDIT / REMOVE NOTE |
| Remove the note | "removed from your store" (misleading — stayed live) | "X is still live in your store — only your note was removed" |
| Stats bar | Products / Published / Pending | Products / Live in store / With note |

## Proof captured
- Grep: zero remaining `is_published`, `handlePublish`, `handleUnpublish`,
  `publishedCount`, "PUBLISH TO MY STORE" in the screen.
- Backend note API unchanged → no server-side regression risk.
