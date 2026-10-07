# Expected Outputs — Courier-ready addresses

> Step 3 (cont.). Defined BEFORE coding. "Compiles" is NOT an expected output.

## Checks
| # | What must be true | Proof |
|---|---|---|
| 1 | The street rule: 10–140 characters, a number that is not only the pincode | `backend/tests/courier-ready-addresses.test.js` — the pure rule, case by case |
| 2 | Registration refuses a store address with no shop or door number, in that sentence, and creates nothing | same file, `POST /brands/register` |
| 3 | Registration with a complete address works and the Main Branch carries it | same |
| 4 | Add / Edit branch refuse the same way; a complete address saves | same, branches routes |
| 5 | Landmark and store phone save, come back, and can be cleared; their two refusals are sentences | same |
| 6 | A branch object carries `courierReady` and, when not, `courierProblem` in words | same |
| 7 | The website's profile save applies the rule only when the address is sent | same, `PATCH /brands/me` |
| 8 | Pricing and booking refuse an incomplete branch with `BRANCH_ADDRESS_INCOMPLETE`, naming the branch; nothing is charged | same, Remote routes |
| 9 | The courier is given the brand's name + branch name as contact, the store phone (or the login number), the landmark as line two, and the brand as the label's sender | `backend/tests/shiprocket-connector.test.js`, request bodies |
| 10 | A return is addressed to the brand's name, the street with its landmark, the store phone | same |
| 11 | The store's courier code changes when its landmark or phone changes (so the courier is told) | same |
| 12 | A creator's street: 190 accepted, 191 refused | `courier-ready-addresses.test.js` |
| 13 | The city message says "city", not "nearest major city" | same |
| 14 | Edit branch shows the hint, the counter, Landmark, Store phone (prefilled), and "City" | `Packages/Mobile` — `courierReadyAddresses.test.js` |
| 15 | Edit branch sends `landmark` and `phone`; its own check refuses a street with no number before the server is asked | same |
| 16 | Brand registration and re-submit say "City" and refuse a street with no number | same |
| 17 | Book the parcel greys a branch that is not courier-ready and says why | same |
| 18 | The creator's street box stops at 190 and shows the hint | same |
| 19 | The website's sign-up and profile pages say "City" and carry the hint | source assertions in the same mobile-side test are NOT enough — proved by the before/after captures in `06-diff/` |

## Data assertions
- Migration 205 adds two nullable columns and changes no row.
- No wallet row is written by any refusal.

## Regression surface that must stay as it was
`item3-branches`, `item3-profile`, `registration-profile`, `influencer`, `brand`, the item 10 and
item 11 suites, `shiprocket-connector`, `shipping-layer`; mobile `item3Brand`, `item8Brand`,
`registrationProfile`, `remote11`, `remoteScreens`, `popupsAboveKeypad`, `saveBarToast`.
Tests that pinned the OLD wording ("Nearest major city", "under 200 characters") are assertion
drift caused by an approved wording change: updated to the new words, never loosened.

## Visual evidence required
Before / after of: Edit branch (app), brand registration address block (app), Book the parcel
branch picker (app), creator delivery address (app), Settings → Profile address block (website).
