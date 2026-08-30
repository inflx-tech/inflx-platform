# Dates stop losing a day

**Founder, 2026-08-30**, after asking for a complete analysis of every date in the campaign flow:

> *"ok pls fix this"*

Plus one rule change he approved in the same message: **the visit buffer drops from 2 days to 1.**

---

## 1 · The bug

`contracts.posting_date` is a Postgres **DATE** — a calendar day, "30 Aug 2026". Not an instant.

The pg driver still hands it to Node as a `Date`, built at **local midnight**:

```
stored        2026-08-30
Node receives 2026-08-29T18:30:00.000Z     ← midnight in India is 6:30pm UTC the day before
```

Anything that then does UTC arithmetic on it is **one day early**:

```js
latest.setUTCDate(latest.getUTCDate() - 2)   // → 27 Aug, when 28 Aug was meant
value.toISOString().slice(0, 10)             // → "2026-08-29", when it is the 30th
```

Both were live in `getVisitDateRange`. **Every visit window in the system was a day short**, on
every campaign, silently. Nobody noticed because a separate bug meant nobody could see the
window at all.

## 2 · Why local getters are the right read

The driver builds the Date at midnight in whatever timezone the process runs in:

| Server | Receives | `.getDate()` | `.getUTCDate()` |
|---|---|---|---|
| IST — this laptop | `29 Aug 18:30Z` | **30** ✓ | 29 ✗ |
| UTC — Render | `30 Aug 00:00Z` | **30** ✓ | 30 ✓ |

**Local getters give the stored day on both.** The UTC getters agree only by luck, on one of
them — and the one they agree on is not the one this code was written and tested on.

## 3 · The fix

One helper, `utils/indiaDay.js`, and one function rewritten to use it.

| Function | What it answers |
|---|---|
| `calendarDay(v)` | the day a **DATE column** holds — local getters, never `toISOString` |
| `istDayOf(instant)` | the Indian day a **timestamp** falls on — 6:30pm UTC is already tomorrow |
| `todayInIndia()` | today in India, not "today on the server" — Render is UTC |
| `addDays` · `daysBetween` · `isBefore` · `isAfter` | calendar arithmetic, no instants involved |
| `startOfIndiaDay` · `endOfIndiaDay` | the first and last moments of a day, for comparing a slot |

⚠️ **`getVisitDateRange` now returns calendar days**, `'YYYY-MM-DD'`, not ISO instants. That is
what a date picker wants and what a person reads. The phone already slices to ten characters, so
nothing there changes.

## 4 · Two things fixed on the way

**The dead branch.** The window's second rule read `content_end_date`, which **nothing in either
app has ever written**. The field the wizard actually writes is `window_end`. So that rule never
fired and the window silently fell through to the campaign end, or to the year-out ceiling. It
now reads `window_end` first.

**The boundary comparison.** A slot is an instant; the window is calendar days. Comparing them
in UTC refused a 9am visit on the last allowed day, because 9am IST is 3:30am UTC **the next
day** — the same off-by-one wearing different clothes. Comparison now runs against the first and
last moments of the day *in India*.

## 5 · The buffer

> *"yes fine your recommendation"* — the visit must now finish **1 day** before she posts, not 2.

With a 7-day minimum on a set and invitations closing 3 days before the post, a 2-day buffer
left no day at all for the visit.

## 6 · What is NOT changed

* **No global driver change.** Turning every DATE column into a string would have touched 30
  columns across 16 tables — follower bookings, meal orders, subscriptions. The arithmetic bug is
  confined to **one function**, and that is what got fixed.
* **The phone was already right.** `DateField.parseISO` builds a calendar day from its parts
  deliberately, with a comment saying why. Nothing there needed touching.
* The other 29 date columns are untouched.
