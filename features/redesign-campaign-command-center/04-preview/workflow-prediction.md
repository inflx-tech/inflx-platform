# Workflow prediction — Campaign Command Center

Brand opens /dashboard/campaigns/[id] → full-width header strip (campaign
identity + honest content counts + reach/ER + Refresh) over three tabs.

- Hierarchy (default): sets expand → influencers expand → deliverables (all
  states visible: LIVE with stats + ↻, SUBMITTED with [Review now],
  AWAITING LIVE-CONFIRM with [Confirm live], PENDING) + product chips per
  influencer. Set/influencer rows carry inline analytics from the existing
  /engagement by_set / by_influencer aggregates.
- Products: full table product | category/section | set | influencer(s) |
  price | status, from /campaigns/:id/products (+ set-name enrichment).
- Analytics: 4 levels (campaign → set → influencer → deliverable), each
  deliverable row with its own ↻ (POST /deliverables/:id/refresh-stats);
  header Refresh re-scrapes every live deliverable then refetches engagement.
- Needs-attention banner on top replaces the right rail (full-width layout).
- Review now / Confirm live route into the existing reviews flows.

Data calls predicted: getById + getEngagement + getCampaignProducts on load;
refresh-stats per deliverable on demand. No new tables; one endpoint
enrichment (set names on products).
