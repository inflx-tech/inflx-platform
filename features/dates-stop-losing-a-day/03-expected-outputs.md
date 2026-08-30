# Expected outputs

| File | Change |
|---|---|
| `backend/src/utils/indiaDay.js` | **new** — calendar days, in India, without losing one |
| `backend/src/services/production.service.js` | `getVisitDateRange` rewritten on calendar days; `isWithinRange` compares against Indian day boundaries; buffer 2 → 1; reads `window_end` |
| `Packages/Mobile/src/screens/brand/__tests__/stage4Shoot.test.js` | one over-specific check relaxed |

No migration. No mobile source change — the phone was already correct.

## Verification

- `backend/tests/india-day.test.js` — 23 checks, **12 mutations, 12 caught**
- Backend regression: shoot-plan 29/29 · brief-to-signing 19/19 · deliverables 19/19 ·
  usage-term 20/20 · stage4-parcel 25/25 · offers-parity 12/12 · coupon 11/11
- Mobile suite **48 suites / 565 tests**
- **Run against every live contract**: a post due 10 Sep now gives a window of 31 Aug → 9 Sep.
  Exactly one day before the post, which is the rule.

Certified no-regression. Never claimed green.

## Two checks that were wrong, both mine

- **My own boundary fixture.** I wrote that 6pm UTC is already tomorrow in India and expected the
  31st. Wrong — the turn is at 6:**30**pm, so 6pm UTC is 11:30pm the same day. **The test caught
  my fixture**, which is what a boundary test is for. Corrected, and the reason kept in the file.
- **A check from yesterday pinned the arithmetic**, `latest.getTime() < earliest.getTime()`, so it
  broke the moment that arithmetic correctly moved onto calendar days. It now asserts the flag and
  the reason exist, not how the comparison is spelled.

## One check that passed while testing nothing

`toContain('r.window_end || r.content_end_date')` was satisfied by **either** of the two places
the phrase appears, so breaking the branch condition alone stayed green. Now both sites are
asserted separately.

Ninth time this session. Every one found by mutation, none by reading.
