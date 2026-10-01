# posting-date-last-day — expected outputs: the checks

Backend: `shopper-app-v2` (S), `shoppable-posts-v2` (P), `post-links-codes` (L), `creator-terms-v2`
(T). Phone: `create13`, `item4Brand`, `item5Brand`, `contentScreens` (M). Status comes from the test
run, never by hand.

| # | Check | Proved by | Status |
|---|---|---|---|
| 1 | An approved post with its posting date twelve days ahead is in the feed, can be opened, reads "live" on her screen and on the brand's Going live, and opens from its code | S "approved with the posting date twelve days ahead…"; S "only live posts: in the shop once approved…" | pass |
| 2 | An offer post whose offer has not started is not in the shop; her screen, the brand's and the code name the offer's start day; it goes live when the offer starts | S "an offer post waits for its offer to start…"; P "approved before its offer starts…"; L "before its offer starts…", "share (approved, its offer not started yet)…" | pass |
| 3 | A post leaves the shop when its offer ends, is taken down, or is sold out (unchanged) | S, same two tests | pass |
| 4 | A post approved after the posting date is live at once and marked late for the brand | S "a post approved after the posting date is still live, and is marked late…" | pass |
| 5 | The approval notice says "It is live in the shop now", or the offer's start day | P "an approved post is live once its offer is running…", "approved before its offer starts…" | pass |
| 6 | An offer can be given only if it starts on or before the posting date and ends at least a day after it; the others are left out as "starts", "ends" or "ended" | T "starts on or before the posting date and ends after it…" | pass |
| 7 | Sending terms with an offer that starts after the posting date is refused with the sentence | T "refused: nothing to sell…" | pass |
| 8 | Products without offers: only those in no offer from today on; an offer already over frees its product; one still to run before the posting date does not | T "only products not held by any offer from today on…" | pass |
| 9 | Sending a product that is in an offer, now or later, is refused and names it | T "refused: nothing to sell…" | pass |
| 10 | The phone sentences say "by", not "on" (the set's date field, the countdowns, the collaboration line, the post in review, the post waiting for its offer, the terms sheets) | M — the nine updated expectations | pass |
| 11 | Nothing else moved: full backend run against today's earlier full run (1831 tests / 1625 passed / 178 failed → 1834 / 1629 / 177; 0 that passed before fail now, 0 new tests fail, 1 old red now green); full phone suite | `06-diff/backend-compare.txt`; phone 840 / 840 | pass |

## Drift recorded (business-rule drift, founder's rules of 1 Oct 2026)
Every one of these tests encoded "an approved post goes live on the posting date" or the old terms
rules; each expectation was moved to the new rule, none removed:
- **S** "only live posts: not before the posting date…" (now: in the shop once approved); the code
  test's "upcoming" post (now: its offer has not started).
- **P** "approved before the posting date…" (now: before its offer starts); "after the posting date an
  approved post is live" (now: live once its offer is running, and at once when it already runs);
  the offer-page count used the posting date to make a post live (now: its offer started).
- **L** the `livePosting` helper moved the posting date into the past (now: starts the world's
  offer); the two "goes live on" checks named the posting date (now: the offer's start).
- **T** "valid on the posting date or the day after" (now: starts on or before, ends after);
  "not held by an offer on or after the posting date" (now: from today); two refusal sentences.
- **M** nine sentence expectations.
Also corrected: `item6-negotiation` "the settings read with their ranges" had been red since 29 Sep
(the nine shopper-feed keys were missing from its list); it now carries them and is green.
