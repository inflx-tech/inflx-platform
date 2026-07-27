# Before / After — discovery range sliders (step 2b)

**Before:** the five numeric filters (Min/Max followers, Min ER %, Min/Max rate ₹) were raw
`type="number"` boxes with placeholder hints — you had to know and type exact figures.

**After:** each is a **FilterSlider** — label + **live value readout** + range input:
- Min/Max followers: 0–1M, step 5k, shown via `fmtNum` (e.g. "50K").
- Min ER %: 0–15, step 0.5, shown as "3.5%+".
- Min/Max rate ₹: 0–100k, step ₹1k, shown via `fmtRupees`.
At the zero position the readout says **"Any"** and the slider emits `''`, so `doSearch`'s
truthy param gate omits the param — **identical filter semantics to the old empty box**.
Combined with step-2 live filtering, dragging re-filters results on settle.

## Changed
- `influencers/page.js` — added the co-located `FilterSlider`; swapped the 5 number inputs.

## Verification
- **`next build` compiled clean** (77 pages).
- **Pending (web verify):** founder on Vercel — drag a slider → value updates and results
  re-filter; drag to zero → reads "Any" and the filter switches off.

## Known delta / deferred
- City / niche / language remain **free-text** (pick-from-list needs a canonical taxonomy).
- Platform filter + audience-fit filters remain backend-batch.
