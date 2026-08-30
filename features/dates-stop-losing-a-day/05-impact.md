# Impact

**One line:** every visit window was a day short on every campaign; it no longer is, and the
buffer drops from two days to one.

## Production-impacting

- **Render** — `backend/src/**` only
- **No migration**, no data change, no OTA. The phone source did not change.

## Behaviour that changes

| Who | Before | After |
|---|---|---|
| Anyone booking a visit | window ended a day earlier than intended | the day it should |
| Anyone booking on the last allowed day | 9am was refused as "out of range" | accepted |
| A set with a posting window | that rule never fired — dead field | fires, on `window_end` |
| A visit against a posting date | had to finish **2 days** before | **1 day** |
| A campaign with no dates at all | unchanged — a year out | unchanged |

## Rows already in production

Nothing written. The change is read-time arithmetic.

Checked against all six live contracts: five now show a real ten-day window; the sixth is
correctly impossible because its post is due today.

## Risk

- The response now carries `'YYYY-MM-DD'` where it carried an ISO instant. The phone slices to
  ten characters and parses calendar days deliberately, so it reads the same. Verified in the
  mobile suite.
- The other 29 DATE columns are untouched. A global driver change would have been the tidier fix
  and a far larger blast radius — 16 tables including follower bookings, meal orders and
  subscriptions. The arithmetic bug lived in one function; that is what was fixed.

## Carried, not fixed

- `campaign_influencers.submission_deadline` is written as posting date − 24h and **read by
  nothing**; `deliverables.submission_deadline` is written as the posting date with no offset.
  Two fields, one name, different values.
- Four dead date columns: `content_start_date`, `content_end_date`, `post_date`, and
  `campaign_influencers.window_start/end`.
- `offer_expires_at` means "48 hours" on one path and "her posting date" on another.
