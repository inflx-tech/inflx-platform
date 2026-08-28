# Impact

**One line:** a brand can now counter-sign a commission deal, and the creator is told she is
selling rather than told to attend a shoot that does not exist.

## Production-impacting

* **Render** — `backend/src/**`
* **OTA influencer** — the shoot headline
* **OTA brand** — none

## Behaviour that changes

| Who | Before | After |
|---|---|---|
| Brand counter-signing a commission deal | **refused, dead end** | goes through, no deliverables |
| Brand counter-signing a fee deal with no formats | refused, in database language | refused, in plain words |
| Commission creator, signed | would have been shown an invented reel as pending work | shown nothing owed, because nothing was bought |
| Commission creator, no shoot | *"The shoot — settle the time…"* forever | *"You are live — share your link"* |
| Commission creator **with** a shoot | *"The shoot"* | **unchanged** |
| Fee creator | unchanged | unchanged |

## Rows already in production

Nothing is migrated. Existing deliverables are untouched — the rule only decides what gets
**created**, and only at countersign or on the self-healing backfill.

Proven against every set in production: 10 sets, 9 now pass, 1 correctly still refuses.

## Risk

* A set whose goal is unknown is treated as **not** buying content. Refusing a signature over an
  unrecognised value would block real work on a guess; not creating deliverables is recoverable,
  a refused countersign is not.
* A commission collaboration cannot reach `done` on its own — unchanged from before, and now
  reachable on a path that previously could not be entered at all. Flagged, not fixed.
