# Impact

**One line: the Creators tab stops hiding which direction a conversation came from, and
Find stops spending a third of the screen on filters nobody set.**

## Deploy class

**production-impacting** — brand app via OTA. **No backend change. No migration.**

## Blast radius

| Area | Effect |
|---|---|
| Creators → Talking | Splits into Sent and Received |
| Creators → Agreed | Rows show settled terms; expiring first |
| Creators → Find | Search on top, chips, bottom sheet, new action bar |
| The Where picker page | Retired |
| Everything else | Untouched |

## The risk worth naming

**Talking is the most-used screen in the brand app**, and this changes how it is read. The
counts, the ordering and the routing are unchanged underneath — a conversation still opens
the same screen it opened before. What changes is which list it appears in.

**A conversation must appear in exactly one of Sent and Received, never both and never
neither.** The direction is already carried on every row (`source: 'request' | 'proposal'`),
so this is a partition of a list that already exists — but it is the thing to check first
on a handset.

## Reversibility

Front-end only. An OTA rollback restores the previous behaviour exactly.
