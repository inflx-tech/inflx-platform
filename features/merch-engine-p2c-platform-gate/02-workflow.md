# Workflow Definition — Platform-page product gate

> Step 3. Backend-only; API-level assertions.

## Actor
**Follower** opening Home / a Category screen (section feeds).

## Preconditions
- Approved brand with active products (all `pushed_to_store=true` by default after mig 101).

## Workflow steps (user-observable)
1. **Follower** opens Home / Category → the product shelves (`products_in_category`) show the brand's **pushed** products. With everything pushed, this equals today (parity).
2. The category's **business shelf** (`businesses_in_category`) lists a brand only if it has at least one **pushed** product.
3. **Brand un-pushes** a product (2a toggle → `pushed_to_store=false`) → that product **leaves** the Home/Category product shelves (and the brand store), staying in the catalogue + creator stores.
4. Brand un-pushes **all** its products → the brand drops out of the category business shelf.

## Success definition
- `products_in_category` returns only `is_active AND pushed_to_store` products of approved brands.
- `businesses_in_category` surfaces a brand only if it has a pushed active product.
- Pre-change (all pushed) output == today's output (parity).

## Failure / edge workflows
- Brand with zero pushed products → absent from category shelves (expected).
- No other shelf/offer behaviour changes.
- (Deferred 2c-2) an un-pushed-but-creator-allocated product does NOT appear on platform pages this slice — it remains visible in the creator's store (2b).
