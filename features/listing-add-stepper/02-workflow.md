# Workflow — Listing Add stepper

## Happy path (fashion leaf with variants)
1. Brand drills Fashion › Women › Ethnic › **Saree** (unchanged).
2. Leaf opens on **Step ① Basics**: upload cover photos, type name, pick/type
   brand, enter price + stock. **Next** is disabled until photo + name + price
   are valid; missing fields highlight inline.
3. **Step ② Variants**: pick Colour(s) → a card per colour for its photos +
   per-size stock; pick Size(s). Colour required. **Next**.
4. **Step ③ Details**: required descriptive facets (e.g. Fabric) shown first;
   optional ones (Pattern, Care, Work, Border, Occasion…) under "More details",
   collapsible/skippable. **Next**.
5. **Step ④ Review**: a summary card (name · ₹price · colours · key facets).
   **+ Add this item** → stages it in the batch list, resets to Step ① with
   **brand + common descriptive facets pre-filled** for the next product.
6. Repeat; then **Save all N products** → `batchCreate` (unchanged) → SKUs back.

## Furniture leaf (few/no variant facets)
- Same flow; **Step ② auto-skips** when the leaf has no `variant` facets, or
  shows only the present variant facets (Seater/Doors/etc.). Dimensions land
  in Step ③.

## Edge cases
- Back-navigation between steps preserves draft state (no data loss).
- A leaf with zero optional facets → Step ③ shows only required (or skips to
  Review if none).
- Per-step validation must match `taxonomy.validateItem` exactly so a staged
  item never fails server-side after passing the steps.
- "Pick another item type" (re-drill) still available from the leaf header.
