# Impact Analysis — A YouTube channel that only posts shorts must still show its subscribers

**Verdict: server only, two functions, no database change, no screen, no app update.
PRODUCTION-IMPACTING (Render redeploys the backend) — explicit go required before the push.**

## Survey — every reader of a YouTube run's channel totals

Read in the code on 25 Oct 2026 (`grep youtubeChannel`, `grep "subscribers: null"` in `backend/src`):

| Where | What it did | Verdict |
|---|---|---|
| `socialCalc.service.js` `youtubeChannel` | first non-error item; `subscribers: null` when it carries none | **THE DEFECT. Fixed:** first item that carries a count; otherwise empty |
| `socialMeasure.service.js` `youtubeRun` posts/full | `good = !chV.error ? chV : …` — an empty Videos answer beats a full Shorts answer | **Fixed:** first answer with totals |
| same, profile run | one-item Videos read; empty → `{ subscribers: null }` stored | **Fixed:** Videos then Shorts; empty → no snapshot |
| same, full-run fallback | one-item Videos read; empty → `{ subscribers: null }` stored | **Fixed:** same helper |
| `youtube.service.js` `fetchChannel` (the older sync helper, admin review page) | Videos tab only, one item | Not in the measuring pipeline; the item 3b write-through is the only writer of the number columns. **Left, named** — a shorts-only channel on the admin's older "YouTube figures" read still shows nothing |
| `socialAccounts.service.js` `writeThrough`, `cardNumbers` | copy whatever the latest snapshot holds | OK — unchanged |

## Affected files
- `backend/src/services/socialCalc.service.js` — `youtubeChannel`, new `parseCount`
- `backend/src/services/socialMeasure.service.js` — `youtubeRun`
- `backend/tests/item3b-pipeline.test.js`, `backend/tests/item3b-calculators.test.js` — new cases

## Affected routes / APIs
None change shape. `GET /influencers/:id` `social.youtube.subscribers`, `GET /influencers/:id/social/youtube`,
`GET /brands/me/discover-creators` `youtube` and the creator's own `GET /influencers/me/social` all
start carrying the number for shorts-only channels after the account's next measurement.

## Apify cost
- Posts/full runs: unchanged (two tab runs).
- Profile runs on a shorts-only channel: one extra one-item run (~US$0.004) each week.
- Full-run fallback with nothing in the window on either tab: up to two one-item runs instead of one.

## Affected workflows (regression surface)
- Item 3b measurement end to end — `item3b-pipeline.test.js`, `item3b-calculators.test.js`.
- Brand Creator screen, Discover, the creator's Accounts screen — read the same columns, no code change.

## Migration / deploy / OTA / data
- No migration. No website change. No phone change, no OTA.
- Backend only → one push. Existing blank snapshots are not rewritten at release; each affected
  account heals on its next profile run (≤ 7 days) or at once with admin **Measure now**
  (`POST /admin/social/accounts/:id/measure-now`).
