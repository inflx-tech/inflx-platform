# Workflow — listing-tags-at-add

1. Admin: /admin/tag-vocabulary → scope `fashion` → add "Monsoon", "Wedding".
2. Fashion store: Listings → Add item → drill to leaf → details step shows
   **Tags** chip row: [Monsoon] [Wedding] (+ any ALL-scope tags).
3. Store taps Monsoon → chip highlights → adds product → saved with
   tags=['monsoon'].
4. Store edits the product later → Monsoon chip pre-selected; toggling off and
   saving clears it.
5. Admin: App Builder → My rule → tags: monsoon (+ min discount 40) →
   "Check matches" counts the product → banner fills for followers.
6. A store with no vocabulary for its world sees NO tags row (zero noise).
7. API called directly with a made-up tag ("my-cool-tag") → dropped by the
   curated filter; only vocabulary slugs persist.
