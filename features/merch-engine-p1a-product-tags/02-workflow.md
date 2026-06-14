# Workflow Definition — Product Tags + admin tag-vocabulary

> Step 3. Each numbered step becomes an assertion in the QA workflow test.

## Actor
Two actors: (A) logged-in **admin** (`requireAnyAdminRole`); (B) logged-in **brand**, approved, business `category_key = 'fashion_walkin'`.

## Preconditions
- One approved brand with at least one existing product.
- Tag vocabulary empty for scope `fashion_walkin` at start.

## Workflow steps (user-observable)
1. **Admin** opens **Tag Vocabulary**, scope = Fashion → adds tags **"Summer"**, **"Festive"**, **"Casual"** → list shows 3 active tags. → vocab rows created.
2. **Admin** adds a cross-business tag **"Trending"** under scope **ALL** → appears for every business.
3. **Brand** opens the listing wizard for a product → the **tag step** shows the fixed options *Summer · Festive · Casual · Trending* → brand selects **Summer** + **Casual**, and types a free tag **"beachwear"** → saves product. → `brand_products.tags = {summer, casual, beachwear}` (slugs), with `summer/casual` resolved to vocab, `beachwear` flagged free.
4. **Brand** re-opens the product → the previously chosen tags are pre-selected; brand removes **Casual**, adds **Festive** → saves. → tags now `{summer, festive, beachwear}`.
5. **Admin** hides **"Casual"** in the vocabulary → it disappears from the brand picker for new edits, but any product already tagged `casual` keeps it.

## Success definition
The workflow is SUCCESSFUL only if:
- `tag_vocabulary` holds the admin-created rows (scopes `fashion_walkin` + `ALL`), and
- the product's `tags` array reflects exactly the brand's final selection (fixed tags validated against active vocab, free tag stored normalized), and
- hiding a vocab tag does **not** mutate any product's existing `tags`.

## Failure / edge workflows
- Brand submits a tag not in the active vocab → stored as a **free tag** (normalized slug), **not rejected** — brands may add their own tags. (The vocabulary governs what the picker OFFERS and what admin Collections rule on, not what a product may carry.)
- Brand submits over-long / duplicate / non-array tags → normalized, de-duped, capped (≤25 tags, ≤40 chars each); no error.
- Non-admin hits `/admin/tag-vocabulary` → `FORBIDDEN`, no write.
- Brand with no tags selected saves normally → `tags = {}` (valid).
