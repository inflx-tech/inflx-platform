# Flow 32 — Impact

**Chat verdict (terse)**: zero functional / backend / logic / DB impact — visual + UX only.

## Files changed

| File | Change | LOC delta |
|---|---|---|
| `Packages/Mobile/src/screens/influencer/CampaignCompletionScreen.js` | brandPalette + fonts + locked design call overrides; targeted edits + bulk swap | 672 → ~660 |
| `Packages/Mobile/src/screens/influencer/CampaignProductsScreen.js` | Full rewrite to brandPalette + fonts; preserve 4-API publish flow | 344 → ~360 |
| `Packages/Mobile/src/screens/influencer/MyStoreScreen.js` | Full rewrite to brandPalette + fonts; preserve `useFocusEffect` + CATEGORY_EMOJI | 209 → ~210 |
| `features/redesign-flow-32-*/` | 7 contract artifacts | new |
| `design/wave2/flow-32-*/` | mockup web.html (already created) | new |

**Total source delta**: ~1,225 → ~1,230 LOC (≈+5; cosmetic).

## APIs touched

**ZERO** — all 6 APIs (getMyCampaignDetail / getCampaignCommissionDetail / getCampaignProducts / upsertProductNote / getProductNotes / deleteProductNote / getMyStorePreview) preserved verbatim.

## Backend changes

**ZERO** — no controllers, routes, migrations, schema changes.

## Regression surface

- **`pnpm qa` 76 Playwright tests**: zero Mobile-touching tests (mobile is Maestro lane); expect 76/76 GREEN gate 0 first-run with dual-probe pre-warm.
- **`pnpm qa:db`** (informational DB lane): unchanged — no schema touched.
- **Maestro 4/4 baseline** continues to apply. Deep Flow 32 visual verification deferred per `maestro-influencer-coverage` open question (admin-verify gate blocks new accounts from reaching Home). Founder physical smoke-test on installed APK (NATIVE_RUNTIME=2) covers.

## Mobile-specific risks

- **CATEGORY_EMOJI constant**: must remain identical across CampaignProducts + MyStore (8 entries: restaurant 🍽️ / salon 💇 / car_rental 🚗 / bike_rental 🏍️ / fashion 👗 / fashion_walkin 👗 / fashion_online 👕 / bakery 🧁 / florist 💐).
- **`useFocusEffect` reload on MyStore**: keep verbatim — switching to `useEffect` would break the published-to-store live update from CampaignProducts.
- **`popToTop()` on Back-to-Campaigns**: keep — `goBack()` lands on CampaignDetail, not MyCampaigns; founder UX expectation = jump back to top of stack.
- **Tranche dot logic**: `t.status === 'released'` drives colour; keep ternary against (success / yellow) per Flow 31 pattern.
- **Goal-aware commission section**: `campaign.goal === 'conversion' || campaign.goal === 'hybrid'` — preserve exact condition.
- **`is_published` flag** drives 3 render branches on each product card; preserve all 3.
- **4-API publish flow on CampaignProducts**: upsertProductNote (publish OR edit) → reload; for unpublish, getProductNotes → find by product_id → deleteProductNote → reload. Preserve sequence.

## Deploy class

**Production-impacting** — mobile screens ship via OTA. Backend untouched. Brand-web / admin-web untouched.

- `ota:brand` v82 (no brand-screen changes; bundle is shared across audiences)
- `ota:influencer` v71 (all 3 Flow 32 screens live here)
- `ota:follower` v45 (no follower-screen changes; shared bundle)

Native rebuild: **NOT required**. NATIVE_RUNTIME=2 already baked into installed APKs since Flow 28.

## Time estimate

- 7 artifacts: 25 min (done)
- 3 screen implementations: 90 min
- Web QA: 5 min (dual-probe + run)
- publish-ota:all: 5 min
- Manifest fetch + close-out lock.json: 10 min
- Push close-out: 2 min

**Total**: ~2h.
