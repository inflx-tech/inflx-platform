# Expected outputs

- GET /v1/influencers/me/posts returns each post with integer like_count
  and save_count (0 when nobody has engaged — a real 0, not a placeholder).
- No other field changes shape; existing consumers are unaffected.
- pnpm qa stays GREEN (79/79, gate 0).

## Explicitly NOT produced

- view_count / impressions (no data source exists — see 01-spec.md).
- Any sales figure per post (needs follower_transactions.post_id).
