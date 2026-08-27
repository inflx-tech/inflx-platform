# Stage 2 walkthrough — Batch A · expected outputs

## 1. The phone

| # | Assertion |
|---|---|
| A-1 | The lock note is gone from the campaign-create screen |
| A-2 | Every date in the wizard is chosen from a calendar, never typed |
| A-3 | A **sales** set's Basics step shows name, start date and channels — and nothing else |
| A-4 | Channels offers exactly **Instagram** and **YouTube** |
| A-5 | A **pay-for-content** set still shows its posting window, its budget and its format counts |
| A-6 | The *hidden — wrong aim* chip is gone, **and nothing replaces it** — founder, 2026-08-27 |
| A-7 | *Go and ask someone new* is gone |
| A-8 | A selling set **saves with no offer**, and the button is never greyed for that reason |
| A-9 | An offer can still be attached, and can be attached later |
| A-10 | Step 4 still offers both routes to an offer — pick an existing one, or make a new one — **and still offers the basket preview** |

## 2. What must not change

| # | Assertion |
|---|---|
| N-1 | No server call changes shape. Batch A is phone-only |
| N-2 | The derived budget on a content set is still computed and still gates publishing |
| N-3 | The six hidden creators are still hidden. The explanation is gone with them |
| N-4 | Allocation is still compulsory on a selling set (Stage 2's own rule, unrelated to the offer) |
| N-5 | The wizard's draft is still unpersisted, so abandoning it still consumes no agreement |
| N-6 | `BrandBasketPreview` is still reachable from step 4. The button stays |

## 3. Regression and governance

| # | Assertion |
|---|---|
| R-1 | `Packages/Mobile` jest stays green — currently 39 suites / 335 tests |
| R-2 | Every `ig.*` token still resolves and every helper is still imported (M-10 guard) |
| R-3 | UI-governed: `mockup_locked` and a non-empty `06-diff/notes.md` before push |
| R-4 | Mobile-governed release: the founder walks W1–W3 on a handset |
