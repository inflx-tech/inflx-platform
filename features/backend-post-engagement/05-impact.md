# Impact

**Zero functional disturbance — additive read-only fields on one endpoint.**

Mechanics:
- Only listMyPosts changed. The SELECT was 'SELECT * FROM creator_posts'
  and is now aliased 'cp' with two correlated COUNT subqueries. The status
  filter clause was re-qualified to cp.status so the alias does not break it.
- hydratePosts is untouched; it builds an explicit object, so the two new
  columns flow through only where added.
- Cost: two indexed-FK counts per returned post, page size capped at 50.
- Nothing consumes the new fields yet, so no UI can regress.
