# Workflow

## Before

```
posting_date stored          2026-08-30
  -> driver hands over       2026-08-29T18:30Z   (midnight in India)
  -> setUTCDate(-2)          2026-08-27
  -> setUTCHours(23:59:59)   2026-08-27T23:59Z
  -> window latest           27 Aug        intended: 28 Aug   ONE DAY LOST

earliest = new Date() +1 day, UTC midnight
  -> on Render after 6:30pm  yesterday's tomorrow
```

## After

```
posting_date stored          2026-08-30
  -> calendarDay()           "2026-08-30"        the day it says, on any server
  -> addDays(-1)             "2026-08-29"        buffer now 1 day
  -> window latest           29 Aug

earliest = addDays(todayInIndia(), 1)            tomorrow in India, not on the server
```

## Comparing a slot against the window

```
window   calendar days      "2026-08-31" .. "2026-09-09"
slot     an instant         2026-09-09T09:00+05:30

  -> startOfIndiaDay("2026-08-31")   2026-08-30T18:30Z
  -> endOfIndiaDay("2026-09-09")     2026-09-09T18:29:59.999Z
  -> 9am on the last day is INSIDE    (in UTC it was 3:30am the next day, and was refused)
```

## Expected end state

A visit window says the days it means, on a laptop in India and on a server in UTC, and a slot
booked at nine in the morning on the last allowed day is accepted.
