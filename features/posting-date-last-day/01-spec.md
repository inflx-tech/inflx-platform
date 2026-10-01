# posting-date-last-day — spec

**The posting date is the last day to go live, not the day itself.** Rules:
`Docs/OFFER_TERMS_POSTS_RULES.md` **v1.15** §2.1, §2.3, §2.4, §4.1, §4.14, §5.12. Background:
`Docs/GOING_LIVE_WALK_REPORT_2026-10-01.md`. Server and both phone apps; no migration.

## The founder's rules (chat, 1 Oct 2026)
> "post date should be a last day for going live all · all invitations to that particular set will
> be closed before 3 days of last date · minimum last date should be at least 7 days, brand can
> extend even more · when post with offer then this post visible to followers only when that offer
> is active · … offer end date should be greater than post date"

and, on the two points put to him ("at least one day after"; "refuse offers that start after the
posting date"): *"your two rules recommendation is accepting"*, and on the testing switch built the
same afternoon: *"why cant make it permanent instead of admin switches?"* — so there is no switch.

## State before (verified 1 Oct 2026)
- An approved post entered the shop on its set's posting date and never before. The first real post
  (KNTZXR, approved 1 Oct) was invisible until 8 Oct; the shop was empty.
- The shop checked that a post's offer had not ended, but not that it had started.
- An offer could be given if it was valid on the posting date **or the day after**: it could end on
  the posting date itself, or start the day after it.
- A product without an offer had to be free of offers only **from the posting date**.

## The rules now
| # | Rule | Before |
|---|---|---|
| 1 | A post is in the shop **as soon as INFLX approves it**. The posting date is not asked. | From the posting date |
| 2 | An offer post is visible **only while its offer is active**: approved before the offer starts → it waits for the start date; the offer ends → it leaves the shop. | Start not checked; end unchanged |
| 3 | An offer can be given to a creator only if it **starts on or before the posting date and ends at least one day after it**. | Valid on the posting date or the day after |
| 4 | A product without an offer can be given only if it is in **no offer from the day the terms are sent**. | From the posting date |
| 5 | Unchanged: invitations close 3 days before the posting date; the date is at least 7 days ahead, any later day allowed, locked once invitations go out; the minimum posts are counted by the date; a post approved after it is "late"; the collaboration is Delayed the day after; social links are due within 2 days of it. | — |

## Decisions (standing autonomy; each follows from the rules above)
| # | Decision | Why |
|---|---|---|
| L1 | No Admin switch. The switch built earlier the same day (never deployed) is removed. | Founder: make it permanent. |
| L2 | The state "approved" now means only "approved, waiting for its offer to start"; every other approved post is "live". The post carries `goes_live_on` (that day) and `live_since` (its approval, or the offer's start if later). | One rule for the shop, the creator's screens, the brand's Going live, links and codes. |
| L3 | The name "Posting date" stays on every screen; the sentences that said "on" it now say "by" it. | Renaming the field touches the agreement and thirty screens for no gain. |
| L4 | Collaborations already sent keep the offers and products they were given. The two terms rules apply from the next invitation. | Terms can't change after sending (2.8). |
| L5 | A third reason joins the "offers not listed" line on the brand's terms sheet: "one ends 8 Oct" (still running, gone by the posting date), beside "one starts" and "one ended". | "Ended 8 Oct" would be wrong for a day that has not come. |
| L6 | Server sentences about the shoot ("the visit has to be before …, her last day to go live") follow. Longer sentences that say "before she posts" stay: they remain true. | Scope. |

## Not in this change
The other fixes in the walk report (confirm before "Take this out"; real covers and a viewer in the
brand app; the Admin player size); making the 7-day minimum an Admin number; letting a brand move a
locked posting date.
