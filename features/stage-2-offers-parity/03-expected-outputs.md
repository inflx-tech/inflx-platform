# Batch B — expected outputs

## 1. The defect

| # | Assertion |
|---|---|
| D-1 | `buildDiscount` no longer hardcodes a scope |
| D-2 | `buildVolume` no longer hardcodes a scope |
| D-3 | An offer built with scope *category* stores that category, not `store` |
| D-4 | An offer built with scope *products* stores the product ids |
| D-5 | Scope defaults to `store` **only when the brand chose it** |

## 2. Parity with web

| # | Assertion |
|---|---|
| P-1 | All **five** types exist on the phone: discount, volume, bogo, bundle, free_gift |
| P-2 | The phone writes the same `offer_config_json` shape web writes, per type |
| P-3 | `availing_modes` is sent explicitly, never left to the database default |
| P-4 | The pay-at-store applicability warning appears when scope is category or products |
| P-5 | An offer created on web opens on the phone with every field intact, and vice versa |

## 3. The validity window

| # | Assertion |
|---|---|
| V-1 | A start and an end can be set when an offer is **created**, not only when edited |
| V-2 | `POST /brands/me/offers` accepts `store_starts_at` and `store_ends_at` |
| V-3 | Either may be left blank, and blank means no limit |
| V-4 | An end before the start is refused, in words |
| V-5 | Checkout still refuses an offer outside its window — **unchanged behaviour, re-proved** |

## 4. Per creator

| # | Assertion |
|---|---|
| C-1 | An offer attaches to one `campaign_influencer`, not to the set |
| C-2 | A library offer writes `brand_offer_id`; a bespoke one writes `offer_type` + `offer_config_json` — never both |
| C-3 | A creator with no offer still saves |
| C-4 | Her offer can be changed or removed after the set is saved |
| C-5 | `offer_valid_until` carries her end date, and `offer_expires_at` is left alone |

## 5. Regression and governance

| # | Assertion |
|---|---|
| R-1 | `Packages/Mobile` jest stays green — currently 40 suites / 398 tests |
| R-2 | Every `ig.*` token resolves; every helper is imported |
| R-3 | The two offers already in production still load and still read as whole-store |
| R-4 | UI-governed: `mockup_locked` + a non-empty `06-diff/notes.md` |
| R-5 | Mobile-governed release: the founder walks W1-W5 |
