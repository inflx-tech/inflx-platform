# 03 — Expected outputs

## New files

| Path | What |
|---|---|
| `scripts/sync-legal-to-mobile.mjs` | Generates the mobile bundle from brand-web with company tokens resolved. `--check` re-renders and fails on drift. |
| `Packages/Mobile/src/legal/content.js` | **GENERATED.** 13 documents plus `docsForAudience()` and `getDocument()`. Never hand-edited. |
| `Packages/Mobile/src/screens/legal/LegalListScreen.js` | The Legal section for one app, common documents grouped first. |
| `Packages/Mobile/src/screens/legal/LegalDocumentScreen.js` | Document renderer — `p`, `ul`, `table`, `callout`, plus inline bold and links. Tables become stacked cards. |
| `Packages/Mobile/src/screens/legal/__tests__/LegalScreens.test.js` | 13 tests covering the generated contract, role slicing and both screens. |
| `qa/unit/legal-sync.spec.ts` | The drift guard, inside `pnpm qa`. |

## Modified files

| Path | Change |
|---|---|
| `Packages/brand-web/lib/legal/distribution.js` | Already existed from the web phase; now the single source deciding which app shows what. |
| `src/navigation/FollowerNavigator.js` | `LegalList` + `LegalDocument` in `ProfileStack`, `audience: 'shopper'`. |
| `src/navigation/InfluencerNavigator.js` | Same in `ProfileStackNav`, `audience: 'creator'`. |
| `src/navigation/BrandNavigator.js` | Same in `ProfileStack`, `audience: 'brand'`. |
| `src/screens/follower/MeScreen.js` | "Legal & policies" row under a new **About** group. |
| `src/screens/influencer/ProfileScreen.js` | "Legal & Policies" card above logout. |
| `src/screens/brand/BrandProfileScreen.js` | "Legal & Policies" row after Influencer Proposals; the previous last row loses `linkRowLast`. |

## Invariants

1. **Each route is registered exactly once per navigator.** A duplicate name
   is a hard native-stack crash on tab mount, not a warning.
2. **No `{{TOKEN}}` reaches a user.** Asserted across the serialised bundle.
3. **Role documents do not leak.** A shopper gets neither side agreement; a
   creator gets no refund policy; a brand gets no Creator Agreement.
4. **The shopper set stays the leanest.** Asserted as an ordering
   (shopper < creator < brand) so it holds as documents are added.
5. **The generated file matches its source**, or `pnpm qa` fails.
6. **The Legal screens make no network call** — they work signed-out and
   offline.

## Verification

| Check | How |
|---|---|
| Screens render, every document mounts | Mobile jest — 27 suites / 131 tests |
| Role slicing correct, and mutation-proof | Leak assertions per audience; mutation-checked by leaking the Creator Agreement into the shopper set |
| No duplicate routes | grep per navigator: `LegalList` 1, `LegalDocument` 1 |
| Web and mobile in sync | `pnpm qa` including `legal-sync` |
| Nothing regressed | `pnpm qa` 125 green, gate 0 |
