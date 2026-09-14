# item6-negotiation — workflow prediction

Mockups: `mockups/item6-negotiation-locked.html` (founder-locked, N1–N22, unchanged by the approval
message: "The mockups are unchanged").

| Screen | Predicted | Built as |
|---|---|---|
| N1 Tapping Counter | a sheet with two choices — the money and the work, the posting date or the mode — and the counters-left line | `CounterChoiceSheet6` (`components/negotiation/sheets6.js`), opened from `InvitationScreen` |
| N2 Countering · Pay for Sale | round pill, the locked "Can't be changed" card, the commission field, the change line, the "they can accept, counter once more, or decline" hint | `influencer/CounterScreen.js` + `RoundPill6`, `LockedTermsCard6`, `ChangeLine6` |
| N3 Countering · Pay for Content | fee, deliverables and usage rights together, each with its own change line | same screen, goal = engagement, reusing item 5's `DeliverablesEditor5` |
| N4 Asking for a different date or mode | a date (today + 7 at the earliest), a mode, a note, and the grey box saying what this is not | `influencer/MoveRequestScreen.js` |
| N5 Creator · waiting | newest turn first, the invitation last as plain values, the state box at the top | `influencer/ThreadScreen.js` + `TurnCard6`, `StateBox6`, `ValueLine6` |
| N6 Creator · the last round | the no-more-rounds warning, Accept or Decline only | same screen (`noRoundsLeft` from the API) |
| N7 Brand · your move | the thread, the hint, Accept writes her number onto the invitation | `brand/BrandThreadScreen.js` |
| N8 Brand · countering back | "ROUND 2 OF 2 · YOUR LAST", the below-minimum warning that never blocks | `BrandCounterSheet6` |
| N9 Brand · declining a counter | what it ends, plus an optional reason she sees | `DeclineCounterSheet6` |
| N10 Brand · a request to move | three answers, not two, with the grey box explaining the set keeps its date | `BrandThreadScreen` (the move block) |
| N11 Brand · agreeing to move her | a confirm listing the three things that happen | `MoveConfirmSheet6` |
| N12 Creator · after asking to move | agreed / kept / closed, each with its own sentence on the Collabs card | `CollabsScreen` + `InvitationCard5` (item 5's card, new item 6 lines) |
| N13 Where the pool lives | a row at the top of Campaigns with the count | `BrandCampaignsScreen` (`brandApi.getPool`) |
| N14 The pool | grouped by the date asked for, one Aim at a time, days left, the closing-soon chip | `brand/BrandPoolScreen.js` + `PoolRow6` |
| N15 A set built from the pool | item 4's new-set screen pre-filled from `set-defaults` | `BrandSetEditScreen` (pre-fill only; the screen is item 4's) |
| N16 Her terms, already agreed | item 5's terms screen pre-filled with the agreed money | `BrandCreatorTermsScreen` (pre-fill only) |
| N17 Her invitation from the pool | a line naming the terms, and the date only when it is the date she asked for | `InvitationScreen` (`fromPool`) |
| N18 The switch, on the campaign | on the new-campaign screen, on by default, and on the ⋯ menu | `BrandCampaignNewScreen`, `BrandCampaignDetailScreen` |
| N19 When the brand has countering off | no Counter and one plain line saying why | `InvitationScreen` (`counterHiddenReason`) |
| N20 Brand · the set while negotiating | "Your move" first, then Negotiating with a Waiting chip, then item 5's groups | `BrandSetDetailScreen` + `invitationRows.service` group order |
| N21 Every way a negotiation ends | each ending is a sentence with a date; the thread stays readable underneath | `EndingCard6` on both thread screens |
| N22 Admin · Platform settings | the three numbers with their descriptions and ranges, and the audit line at the foot | `Packages/brand-web/app/admin/settings/platform/page.js` |

Deliberate departures: `CounterSoonScreen` (item 5's placeholder) is **deleted**, not repurposed. The
N12 card for a kept date opens the invitation, not the thread, because that is where she can accept or
decline; a card whose conversation is still running opens the thread. N15 and N16 are item 4's and item
5's own screens receiving pre-filled values, so nothing new was drawn for them.
