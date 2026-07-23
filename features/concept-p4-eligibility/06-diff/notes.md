# Before/after — concept-p4-eligibility

## /admin/concepts (the one UI change)
- **Before:** three kind tabs (Category/Price/Offer); no way to see which
  concepts creators actually publish under.
- **After:** fourth tab **"In use"** — concepts ranked by approved posts
  with visible/approved/pending counts, click-to-expand per-creator
  breakdown (@handle · counts); collections section below; honest empty
  states until the first post exists. Follows the page's existing table
  grammar — no new visual language.

## Behaviour (not visual)
- Dark posts (zero eligible products) disappear from the follower feed and
  404 on direct open; the creator is notified once, on the transition.
- Post detail shop lists now sort concept-keeping products first and flag
  each with concept_eligible; pins render only for purchasable products.

Capture note: real screenshots deferred to the release step per program
precedent (no posts exist in prod to photograph yet).
