# Workflow

1. Influencer opens the Create tab.
2. App calls GET /v1/influencers/me/posts.
3. listMyPosts SELECTs creator_posts plus two correlated subquery counts
   over post_likes / post_saves.
4. hydratePosts attaches media + products as before.
5. Each post in the response now also carries like_count + save_count.

## Expected end state

A creator's own post list is engagement-aware in ONE call — no N+1, no
extra endpoint, no client-side fan-out.
