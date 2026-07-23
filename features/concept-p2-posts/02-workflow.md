# Workflow — concept-p2-posts

## W1 — Creator publishes (the golden path)
Home → Create Post → 1) picks "Single brand" + Denim Co → 2) Concept tab,
taps "Winter {…}" chip → leaf modal → Jeans → "Show my products" → "17
products available" → 3) picks 3 photos from the gallery, each uploads via
presigned PUT with a progress line → 4) taps the jeans in slide 1 → product
sheet (the 17) → picks one → pin appears at the tap point; repeats; picks
Soft Editorial; caption; Submit → success alert → My Posts shows "In review".

## W2 — The by-construction guarantee
The create call re-runs the picker server-side; a product id not in the
result → 422 "outside the selected concept/scope". Media keys not under
posts/<own-id>/ → 422. Tag on a nonexistent slide, or x/y outside 0-100 → 422.
Concept XOR collection enforced (both → 422; category template without a
leaf → 422). The concepts row materializes on first use (concurrent-safe).

## W3 — Admin moderates
/admin/posts (📮, approvals cap) → "Awaiting review (1)" → card shows
@handle, "Winter Jeans · family 1", slides with pin overlays, the tagged
product list with prices, caption → ✓ Approve → creator gets the
post.approved push + bell. Reject asks for a reason; creator sees it verbatim
in My Posts.

## W4 — Empty universes are honest
A scope×concept with no live matching products shows "No products match this
concept from your scope right now" and the flow stops — a post can never be
created against an empty universe (min 1 tag enforced anyway).

## Expected end state
node --check green on all new backend files; ROUTES-LOAD-OK; mobile jest
25/25 (pre-existing wallet-suite transform failure unchanged, documented);
pnpm qa GREEN incl. nav-sweep covering /admin/posts; gov-check exit 0.
run-140.js on prod prints all three tables present, 0 rows.
