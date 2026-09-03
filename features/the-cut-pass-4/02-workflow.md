# Workflow — pass 4

## The workflow this protects

**Every workflow that survives.** This pass is only correct if nothing changes for anyone.

The dropped tables were read by no code, so no journey touches them. Verified after the
drop: 129 people, 9 businesses, 48 products, 12 campaigns, 6 contracts, 16 sales, the
333-branch browse tree and the 6 live app shelves are all present and unchanged.

## Where it could have gone wrong, and did not

| Risk | What happened |
|---|---|
| Dropping a table a kept feature reads | Two traps caught before the run — `restaurant_reviews` (the reviews feature, wearing a retired name) and `product_addon_groups` (read by the fashion product grid on every row) |
| Dropping a table with a live dependency | `experience_templates` is referenced by `section_config`, the live app-layout table. The no-CASCADE transaction aborted the whole run and it was excluded |
| Dropping something that had quietly grown | Row counts re-checked at drop time against the survey; a mismatch refuses |
| Losing data that mattered after all | Every row exported to JSON and read back before any drop |
