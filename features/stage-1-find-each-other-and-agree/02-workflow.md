# Stage 1 — workflow

Build order taken from FINAL 1's own recommendation: the history first, because every
other screen hangs off it.

## Server
1. **Read the negotiation history.** `GET /collab-diary/request/:id` and
   `/collab-diary/proposal/:id`. Both sides get the identical payload; access is proved
   from the record itself, and a stranger gets 404 rather than 403 so the response
   cannot be used to learn a conversation exists.
2. **Migration 155** — approved brands become open to creator pitches.

## The creator's phone
3. **Six stages** replace eight in the stage model, and it learns two record types it
   has never seen: a brand's request and her own pitch.
4. **Whose turn** reads who moved LAST, not the status — 'countered' describes both
   sides waiting and cannot answer it alone.
5. **Her Collabs list** fetches requests and pitches alongside offers and campaigns.
   One source failing must not blank the tab.
6. **The badge**, from the count Stage 0 built. Refreshed when the app returns to the
   foreground, not on a timer.
7. **Her pitch thread**, with counter-back — the app half of a capability that has been
   finished and unreachable.
8. **The inbox moves** out of the Profile stack into Collabs, and is restyled from the
   old yellow palette to the ig kit. The Profile row becomes "Find brands to pitch".

## The brand's phone
9. **A Creators tab** replacing Alerts, which moves under Profile. Four sub-tabs.
10. **Talking** merges requests out and pitches in, ordered by who owes a move.
11. **The place picker** over the existing lookup, with counts and zero rows greyed.
12. **Groups**, group detail, and asking a whole group.
13. **Ask many**, with the reach funnel first and every drop named.
14. **The history**, rendering the creator's component with the brand's credentials.

## Checks
- `tests/collab-diary.test.js` — the founder's 15 → 22 → 18 case, both sides identical,
  and the access rules.
- `src/utils/__tests__/collabStages.test.js` — updated to the six-stage model, plus
  direction-decides-stage.
- A duplicate-route check across every navigator stack.

## Expected end state
A brand searches, groups, and asks — one creator, a group, or a filtered set — and is
told honestly who was reached. The creator sees it on the first screen of Collabs with
a badge, answers or counters, and both read the same history afterwards.
