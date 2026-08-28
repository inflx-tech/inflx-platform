# Expected outputs

## Backend

| File | Change |
|---|---|
| `src/services/allocation.model.js` | **new** — `describeAllocation()` |
| `src/controllers/contract.controller.js` | selects `alloc_*`, `brand_offer_id`, `offer_valid_from/until`, `commission_pct`, `terms_json->usage`; joins `brand_offers`; returns `sell` + `usage_text` |
| `src/controllers/campaign.controller.js` | `invite` creates a ready contract on a clean agreement |
| `src/services/contract.service.js` | `autoCreate(id, { ready })` |
| `src/controllers/offer.controller.js` | decline from `accepted`; stores `declined_note`; DELETEs the unsigned contract |
| `migrations/163_declined_note.sql` | **applied to production** |

## Mobile

| File | Change |
|---|---|
| `components/influencer/DeclineSheet.js` | **new** — shared sheet, `DECLINE_REASONS`, `askDeclineReason()` |
| `screens/influencer/ContractScreen.js` | three new cards; decline; reads `sell` / `usage_text` |
| `screens/influencer/CollabDetailScreen.js` | uses the shared sheet; `not_a_fit` gone |
| `utils/collabDetailModel.js` | (earlier, same session) the six real stages — the blank page |

## Verification

- `tests/brief-to-signing.test.js` — 19 checks, **14 mutations, 14 caught**
- `src/screens/influencer/__tests__/briefToSigning.test.js` — 13 checks, **10 mutations, 10 caught**
- Mobile suite: **45 suites / 520 tests**, no regression
- `tests/usage-term.test.js` 20/20 · `stage4-parcel` 25/25 · `offers-parity` 12/12 · `coupon` 11/11

Certified no-regression. Never claimed green.

## Two checks that passed while testing nothing — recorded, not hidden

- `expect(src).toContain('askDeclineReason')` was satisfied by the **import line**. Renaming the
  call site left it green. Now asserts the call site and the button text.
- `expect(src).toContain('ci.alloc_category')` was satisfied by the longer
  `ci.alloc_category_node_id`. Deleting the category column left it green. Now anchored with the
  trailing comma, and every column checked individually.

Both found by mutation, not by reading — the third and fourth time this session a check has
passed by matching something other than what it meant to.

## What a user cannot do yet

No screen lets a brand **ask for** commercial usage. The term and the clause both exist; only the
request surface is missing.
