# Workflow
1. Open /dashboard/products (fashion) → drill to a leaf (e.g. Men › Topwear › Polo).
2. Each product row shows its real photo (icon only if it truly has none).
3. Remove a product → it disappears from the list immediately (leaf refetch now
   filters is_active=true).
4. Tick checkboxes (or "Select all") → a bulk bar shows "Delete selected (N)";
   confirm → all removed, list refetched, selection cleared.
5. Switching category/leaf clears the selection.
