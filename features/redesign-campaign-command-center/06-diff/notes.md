# Before / after — Campaign Command Center

**Before (screenshot in founder's W5 report, 2026-06-11):** two-column hub —
yellow progress hero, 4-6 drill tiles (Publishing tile mis-linked to the
influencers page; no products view existed), campaign-only analytics block
with no refresh, 320px right rail mostly empty ("Web-only tools" card),
half the screen unused. Submitted content invisible on the hub (Content
tile counted live+approved only). Hierarchy (set → influencer →
deliverable → product) not visible anywhere.

**After (matches locked mockup 04-preview/mockups/command-center.html):**
full-width — ⚡ attention banner · header strip with honest content counts
(to review · awaiting live · live), budget, escrow, conversions, likes, ER,
and ↻ Refresh analytics (re-scrapes every live post) · three tabs:
- Hierarchy (default): expandable sets (inline set analytics) → influencers
  (rollups, status, manage ↗) → deliverables in every state (submitted =
  yellow + Review now; approved+url = Confirm live; live = stats + ↻) +
  product chips.
- Products: product | category/section | set | influencer(s) | price |
  status table (set joined client-side; brand-level offers labelled).
- Analytics: 4 levels (campaign cards → set bars → influencer bars →
  deliverable rows with ↻).

Deltas vs mockup: escrow + conversions cells added to the strip (existing
functionality the mockup's sample campaign didn't exercise — kept per
no-feature-loss rule); campaign name lives in the page header rather than
a strip cell (avoids duplicating the existing breadcrumb+title pattern).
Founder verifies on the live page post-deploy (walkthrough protocol).
