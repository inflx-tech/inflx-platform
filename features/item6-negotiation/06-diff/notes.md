# item6-negotiation — before / after

**Before:** the founder's locked mockups (`04-preview/mockups/item6-negotiation-locked.html`, N1–N22).
On the phone before this item: the creator's **Counter** button opened `CounterSoonScreen`, a
placeholder that wrote nothing; there was no thread, no pool and no way to ask for a different date
from the new invitation screens. On the server: a negotiation engine existed behind the legacy
`/offers` routes, storing one changed number per turn; a cron auto-declined any negotiation silent for
48 hours; the campaign switch was editable only while the campaign was a draft, and a separate
platform-wide flag could contradict it; **asking to be moved ended the invitation on the spot**, before
the brand had said anything.

**After:** the screens as built, verified by render tests (20 new; whole mobile suite 479 / 479) and
the rules verified against a real database (42 new; full suite 229 failed / 982 passed / 1211, 0 new
failures against the item 5 baseline of 229 / 940 / 1169). No device was attached to this session, so
there are no phone screenshots; nothing is tested end to end until after item 7 (`PROMPT.md` §3).

## Screen by screen

| Mockup | Built as | Differences from the mockup |
|---|---|---|
| N1 Tapping Counter | `CounterChoiceSheet6` | None. |
| N2 / N3 Countering | `influencer/CounterScreen.js` | None in copy. Pay for Content reuses item 5's deliverables editor, so its rows carry item 5's testIDs and its "Add another" wording. |
| N4 Asking to move | `influencer/MoveRequestScreen.js` | Adds a refusal for the date the set already has, and for a date inside item 4's seven-day floor. |
| N5 / N6 Creator thread | `influencer/ThreadScreen.js` | None. |
| N7 / N8 / N9 Brand thread | `brand/BrandThreadScreen.js` + `BrandCounterSheet6`, `DeclineCounterSheet6` | None. |
| N10 / N11 A request to move | `BrandThreadScreen` + `MoveConfirmSheet6` | None. "Keep the date" is one tap with no confirm, as drawn. |
| N12 After asking to move | `CollabsScreen` + `InvitationCard5` | A card whose move was answered opens the **invitation** (where she can accept or decline); a card whose conversation is still running opens the thread. |
| N13 / N14 The pool | `BrandCampaignsScreen` row + `brand/BrandPoolScreen.js` | Adds "· no longer possible" on a wanted date now inside seven days, which the mockup predates. |
| N15 / N16 A set from the pool | item 4's `BrandSetEditScreen` and item 5's `BrandCreatorTermsScreen`, pre-filled | Nothing new drawn; the posting date is left empty when the wanted date is no longer possible. |
| N17 Her invitation from the pool | `InvitationScreen` | Two forms, as approved: with the date she asked for, the line names the date and the terms; with any other date, the terms only. |
| N18 The switch | `BrandCampaignNewScreen`, `BrandCampaignDetailScreen` | None. It is now changeable after publishing. |
| N19 Countering off | `InvitationScreen` | None. |
| N20 The set while negotiating | `BrandSetDetailScreen` | None; "Your move" leads the group order. |
| N21 Every ending | `EndingCard6` on both thread screens | None; five outcomes, `moved` included. |
| N22 Admin platform settings | `Packages/brand-web/app/admin/settings/platform/page.js` | None. |

## Behaviour changes a user could notice
Asking for a different date no longer ends the invitation — the brand answers first, and she keeps her
place until it does. No negotiation is auto-declined after 48 hours; the set's invitation cutoff is the
only deadline, with reminders at 48 hours and 7 days to whichever side owes the move. The negotiation
switch can be turned on or off at any time in a campaign's life. A counter is no longer silently
blocked by a platform-wide payment flag. The `CounterSoonScreen` placeholder is gone. The brand's
offer-expired notification now names the posting date instead of a 48-hour window that was never what
that job measured.
