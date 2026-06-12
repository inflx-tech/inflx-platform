# Expected outputs — Listing Add stepper

## UI (brand-web `/dashboard/products/listing`)
- At a leaf, a **progress header** (① Basics · ② Variants · ③ Details · ④
  Review) with done/current marks; step ② omitted when the leaf has no
  `variant` facets.
- **① Basics**: photos + name + brand + price + stock; **Next** disabled until
  photo + name + price valid; inline "Still needed: …" hint.
- **② Variants**: variant-role facets (colour/size) + per-colour photo/stock
  cards.
- **③ Details**: required descriptive/discovery facets shown; optional under a
  collapsed "More details".
- **④ Review**: summary card → **+ Add this item** stages the product, resets
  to ① with brand + common facets pre-filled.
- **Save all N** → unchanged `batchCreate` → SKUs returned.

## Invariants
- The staged item object + `batchCreate` payload are byte-identical to the
  pre-stepper flow (same products created, same auto-SKUs).
- Per-step validation ⊇ `taxonomy.validateItem` (never looser).
- No backend / `facet_definitions` / DB / migration change.

## Proof (recorded)
- `next build` — compiled successfully; page emitted (7.31 kB).
- `pnpm qa` 79/79 GREEN (report 2026-06-12T04-14-29Z, gate 0).
- JSX parse clean.
