# concept-stageb-discover — the ONE Discover layout (Stage B)

Founder locked the master board (04-preview/mockups/b1-discover.html) after
supplying his reference (page 1 of 2), 2026-07-26: "ok go for B2". Board
grammar: sections = concept families → chips = variants → swipeable banners
(each = ONE concept, live post count) → tap lands on that concept's posts;
creator/brand rows slot between sections with rules (area / following /
popularity). Three pages, one skeleton: global (admin), business (ONE
structure for all stores, rows auto-hide when empty), creator (self-curated).

## B2 scope (this slice — backend + admin, no mobile)

1. **Migration 145** `discover_layouts`: one row per scope
   (global | business | creator-per-influencer), rows_json = ordered intent.
   Applied to prod pre-push.
2. **Resolver** (`discover.service`): turns intent into a render-ready
   payload against LIVE data — banner names via concept naming, counts via
   the Inspector's visible-post logic (approved + eligibility), newest post
   cover per banner, auto-hide of empty banners/chips/sections/rows; creator
   rows ranked by rule with popularity fallback (no city / guest); business
   rows via scoped_brand_ids post counts.
3. **Endpoints**: admin GET/PUT `/admin/discover-layout` (sections
   capability) · follower GET `/follower/discover` (auth optional;
   scope/brand_id/creator_id/city) · creator GET/PUT
   `/influencers/me/discover-layout` (ready for the B4 arranger).
4. **Admin Discover Builder** (`/admin/discover`): scope tabs (Global |
   Business structure), ordered rows (▲▼), inline titles, per-row rules,
   chips editor, banner picker fed by the live Inspector (name + family +
   visible count, red when 0), instant publish (layout is data — no OTA).

## Later slices

B3 follower Discover tab UI (consumes /follower/discover) · B4 creator My
Store arranger (endpoints ready) · B5 business auto-page wiring.
