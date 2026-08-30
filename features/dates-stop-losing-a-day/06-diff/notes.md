# Before / after

Found while answering *"first do one analysis on complete dates issue in entire campaign creation."*

## The day that went missing

`posting_date` is a calendar day. It arrives in Node as an instant at local midnight, which in
India is half past six the previous evening in UTC. Subtracting days in UTC then lands a day
early.

```
stored 30 Aug  →  received 29 Aug 18:30Z  →  minus 2 days in UTC  →  27 Aug
                                                  intended:          28 Aug
```

**Every visit window in the system, on every campaign.** It was invisible because a separate bug
meant the window never rendered.

## What it is now

| | Before | After |
|---|---|---|
| Post due 10 Sep, window ends | 8 Sep *(two days lost: one to the bug, one to the buffer)* | **9 Sep** |
| Tomorrow, computed on Render after 6:30pm | yesterday's tomorrow | tomorrow in India |
| 9am on the last allowed day | refused | accepted |
| The posting-window rule | dead — read a field nothing writes | reads `window_end` |

## The dead branch

The window's second rule read `content_end_date`. **Nothing in either app has ever written that
column.** The wizard writes `window_end`. So the rule never fired, and any set relying on it fell
through to the campaign end date — or, for an open-ended sales campaign, to a ceiling a year out.

The comment recording this had been sitting in `campaignRollup.service.js` since it was written,
about a different consumer, and nobody carried it across.

## Screenshots

None — nothing visible changed. The proof is the numbers: run against all six live contracts, a
post due 10 Sep gives 31 Aug → 9 Sep, which is one day before the post, which is the rule.
