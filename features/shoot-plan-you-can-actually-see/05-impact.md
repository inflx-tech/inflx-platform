# Impact

**One line:** the shoot is now reachable, the button that opens it says what it does, and when no
day can satisfy the rules the screen names the date to move.

## Production-impacting

* **Render** — `backend/src/**`
* **OTA influencer** — the label, the hero, the range, the window card
* **OTA brand** — the range and the window card

No migration.

## Behaviour that changes

| Who | Before | After |
|---|---|---|
| Creator with a shoot | *"You are live"* and a blank button | *"The shoot"* and **Plan the shoot** |
| Anyone opening a shoot, since Stage 4 | the button had no text | it has text |
| Either phone, planning a visit | *"between [blank] and [blank]"* | the real dates, or why there are none |
| A campaign whose post is due too soon | silent dead end | *"No day works — move the posting date back"* |
| Commission creator with no shoot at all | *"You are live"* | **unchanged** — still correct |

## Rows already in production

Nothing written. Every change is read-time.

## Risk

* `production_event` is now looked up on every collab-detail load — one indexed query on
  `contract_id`, wrapped in try/catch, and a failure leaves it null rather than breaking the screen.
* `WindowCard` returns nothing when a date will not parse. A card that cannot say anything true is
  better absent than drawn empty — which is precisely what the founder photographed.

## Carried, not fixed

* The brand cannot move the posting date from the shoot screen. The message tells them what to
  change; they change it where posting dates live.
* `cancelInfluencer` still writes an invalid `contract_status`.
