# Workflow prediction — Listing Add stepper

When the brand reaches a leaf (e.g. Saree) they no longer see one long form.
Instead:

1. A **progress header** shows ① Basics · ② Variants · ③ Details · ④ Review,
   current step highlighted.
2. **① Basics** asks only for photos + name + brand + price + stock. **Next**
   stays greyed until photo + name + price are filled; a missing field shows a
   small inline message (not a bottom dump).
3. **② Variants** shows colour chips → a card per chosen colour (photos +
   per-size stock) and size chips. On a furniture one-off with no variant
   facets, this step is **skipped automatically**.
4. **③ Details** leads with required attributes; the rest sit under a
   collapsible "More details" the brand can skip.
5. **④ Review** shows a tidy summary; **+ Add this item** files it and snaps
   back to ① with brand + common facets pre-filled, so the next item is fast.
6. After staging several, **Save all** writes them exactly as today.

Predicted result: the same products get created (identical SKUs/data), but the
brand fills a handful of fields per screen instead of facing 14 at once.
