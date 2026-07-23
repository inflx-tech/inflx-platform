# concept-p4-eligibility — the promise test + Concept Inspector

**Program:** POST_CONCEPT_BUILD_PLAN.md P4 (backend slice, built while founder
prepares Stage-A screens) · **Architecture:** POST_CONCEPT_MODEL.md §6
**Depends on:** concept-p3-follower-backend + concept-p3-post-globals

## Goal (functional)

1. **The eligibility engine** — a post is visible while ≥1 attached product
   still satisfies its concept; at zero it goes dark and the creator is told
   why. One live test collapses price rises, offer expiry, revoked
   allocation and stock-outs (founder's "promise" model).
2. **Concept Inspector** — the founder's explicit ask: open a rule, see how
   many posts sit under it, by creator.

## Design

- **Test = THE evaluator, again:** concept rule_json + product_ids pin of
  the post's attached products through library_products with the creator's
  scoped allocation → whatever returns is the eligible set. Same truth as
  shelves/preview/picker. Collections (no rule) degrade to attached ∩
  allocated ∩ purchasable; a hidden template degrades the same way rather
  than darkening posts on a vocabulary edit.
- **Live where it matters, cached where it counts** (mig 142):
  eligible_product_count / eligibility_checked_at / went_dark_at on
  creator_posts. The DETAIL endpoint recomputes live every request (dark →
  404) and marks each shop product concept_eligible (founder lock:
  ineligible-but-purchasable stays buyable, sorted below; pins render only
  for purchasable products). The FEED filters on the cache (NULL = never
  checked = visible — never punish a fresh post).
- **Sweep cron** every 30 min (:13/:43 IST, ENABLE_CRONS-gated) recomputes
  approved posts, sets/clears went_dark_at, notifies 'post.dark' on the
  >0→0 transition. Creator's My Posts payload now carries the dark state.
- **Inspector:** GET /admin/concepts/inspector (materialized concepts +
  collections × approved/visible/pending/rejected counts) + /breakdown
  (per-creator). Admin UI = new "In use" tab on /admin/concepts with
  expandable creator rows.

## Non-goals
Banner/discover rendering (needs founder's Stage-B layout) · ranking buckets
(FEED_MODEL P4 — lands with the Discover build) · un-dark notifications.
