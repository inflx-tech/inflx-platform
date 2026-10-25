# Workflow — A YouTube channel that only posts shorts must still show its subscribers

## A · Full / posts run on a shorts-only channel (the defect)

| # | Who | Does | The system |
|---|---|---|---|
| 1 | Scheduler / admin | Measures a YouTube account (full or posts) | runs the Videos tab (window, ceiling) and the Shorts tab (window, ceiling) — unchanged |
| 2 | Apify | Videos tab answers one error item "no videos"; Shorts tab answers her shorts with the channel totals on each | **the snapshot is taken from the first answer whose items carry a subscriber count** — the shorts |
| 3 | Server | Stores snapshot, uploads, metrics; writes through | `creator_social_profile_snapshots.subscribers = 52000`; `influencers.youtube_subscribers = 52000`; long = 0 uploads, shorts measured as before |
| 4 | Brand | Opens the Creator screen | YouTube **52.0K** at the top; card: Avg video views "—" (no long videos — correct), Avg shorts views, Recent uploads |

## B · Weekly profile run (the second half of the defect)

| # | Who | Does | The system |
|---|---|---|---|
| 5 | Scheduler | Profile run due (every 7 days) | one-item read of the Videos tab; **if empty, one-item read of the Shorts tab** |
| 6 | Apify | Shorts tab answers one short with the totals | snapshot stored with those totals; write-through unchanged |
| 7 | Apify | Both reads empty (no readable totals anywhere) | **no snapshot written**; the last good one stays; `last_profile_at` still advances |

## C · Full run with no uploads inside the window on either tab

| # | Who | Does | The system |
|---|---|---|---|
| 8 | Server | Both tab runs come back empty | falls back to the one-item read of step 5 (Videos, then Shorts) |

## Edges

- Not found / private on the Videos tab: the account goes not_found / private and its numbers are
  cleared — exactly as today.
- Items present but **none** carries a subscriber count (an actor build that dropped the totals):
  treated as empty, never as 0 subscribers. The last snapshot stays.
- Totals nested under `aboutChannelInfo`, or written as "8.1K": still read.
