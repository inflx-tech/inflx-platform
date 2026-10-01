# Workflow prediction — offer-add-products
Trigger: a brand opens a Scheduled or Live offer on the website.
- No creator has it → Add products / Remove products / End offer now. Add: browse or search → tick →
  Add → the products join the pool, held from today (or the start date) to the end date; the pool
  count rises; a toast confirms. Remove: unchanged, minus the creator wording.
- A creator has it (signed or invited) → Add and Remove greyed out, the reason on the page, End offer
  now unchanged. The server refuses both even if the page is stale.
End state: `offer_pool_items` gains one row per added product (lock from today to end + 1 day), one
`offer_pool_sources` row (`picked`) records the add; no notification, no money, no post touched.
Edges: product held by another offer (named, refused) · product that breaks the deal (plain-word
reason) · fixed bundle (no button; server refuses) · offer given while the page is open (refused,
page reloads frozen) · two adds at once (brand-level lock, then the database's own exclusion).
