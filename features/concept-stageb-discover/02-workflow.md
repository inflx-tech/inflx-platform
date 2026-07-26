# Workflow — expected end states (B2)

1. Admin opens Discover Builder → Global home → adds a Section, names it
   "Budget Friendly Picks", adds chips, picks banners from the live list
   (each shows its visible-post count) → Publish → instant.
2. GET /follower/discover returns the resolved payload: only banners with
   visible posts, each with title/family/count/cover; sections with zero
   live banners are absent; creator/business rows ranked by their rule.
3. Business structure tab: same tool; GET /follower/discover?scope=business
   &brand_id=X counts only that brand's posts — a store with nothing under
   a row simply doesn't get that row.
4. A post goes dark (eligibility) → its concept's count drops on the next
   resolve; at zero the banner vanishes — no admin action needed.
5. Creator PUT/GET their own layout works (arranger UI lands in B4).
