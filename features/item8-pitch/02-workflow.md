# Item 8 — the workflow, end to end

## The one path

```
She finds a brand (T1)
   └─ the brand list says what it takes and whether she can pitch it
She writes a pitch (T2 → T3 → T4)
   └─ Aim + money → date + mode → why her, then Send
The brand reads it (T5 → T6)
   └─ her numbers, her terms, her message, how long is left
      ├─ Accept  (T7) ──► a POOL ENTRY, and nothing else
      ├─ Counter (T9) ──► item 6's thread, her pitch as turn zero (T10)
      └─ Reject  (T8) ──► a cooldown with a date she is told
The pool (T11)
   └─ she sits beside the creators who asked to be moved, tagged PITCH
The brand builds a set for her (item 4)
   └─ the Aim, date and mode already filled in from her entry
She gets an ordinary invitation (T12)
   └─ with one green line saying why the numbers are familiar
   └─ she accepts, counters or declines it — she has never seen this SET
Item 7's agreement, item 7's signatures, item 7's money.
```

Everything after the pool entry already existed. Item 8 adds a front door.

---

## The endpoints

### Creator
| ID | Method and path | What it does |
|---|---|---|
| E1 | `GET /influencers/me/find-brands` | *(extended)* four statuses now, plus a cooldown date |
| E2 | `GET /influencers/me/pitches/form/:brandId` | the Aims and modes that brand takes, her own minimums, the limit |
| E3 | `POST /influencers/me/pitches` | send — every rule, server-side |
| E4 | `GET /influencers/me/pitches` | her list, grouped waiting / agreed / ended |
| E4b | `GET /influencers/me/pitches/:id` | one of hers |
| E5 | `POST /influencers/me/pitches/:id/withdraw` | take it back; no cooldown |
| E10 | `GET/POST /influencers/me/pitches/:id/thread[/counter\|accept\|decline]` | item 6's engine |

### Brand
| ID | Method and path | What it does |
|---|---|---|
| E6 | `GET /brands/me/pitches` | the inbox, grouped by whose move it is |
| E7 | `GET /brands/me/pitches/:id` | one pitch; opening it marks it read |
| E8 | `POST /brands/me/pitches/:id/accept` | **a pool entry and nothing else** |
| E9 | `POST /brands/me/pitches/:id/reject` | the cooldown, stamped |
| E10 | `GET/POST /brands/me/pitches/:id/thread[/counter\|accept\|decline]` | item 6's engine |

Another brand's pitch, another creator's, is **404** — never 403, which would confirm
the row exists.

### The job
`pitch-housekeeping` hourly at `:35`, India time. Three idempotent lanes: the two
reminders, the unanswered close, and the early close. Never a decline, never a cooldown.

---

## The states a pitch can be in

| Status | How it got there | Can she pitch again? |
|---|---|---|
| `sent` | she sent it | — |
| `viewed` | the brand opened it | — |
| `countered` | either side countered | — |
| `accepted` | the brand agreed | she is in the pool |
| `rejected` | the brand declined | after the cooldown, with the date |
| `withdrawn` | she took it back | immediately |
| `expired` + `no_reply` | the brand never answered | immediately |
| `expired` + `date_passed` | her date came too close for a set | immediately |

Every one of those endings is a plain sentence written by the server and rendered by the
phone as given. The phone never composes a deadline or a cooldown of its own.

---

## Who may do what

| | Creator | Brand |
|---|---|---|
| Send a pitch | yes, subject to §8A + the limits + the cooldown | — |
| Open the thread | no — her pitch was the opening move | yes |
| Counter in an open thread | yes, on her move | yes, on its move |
| Accept | the brand's counter | her pitch, or her last counter |
| Reject / decline | the brand's counter | the pitch, which starts a cooldown |
| Withdraw | yes, until it is accepted | — |
