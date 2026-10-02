# ui-walk-fixes — expected outputs: the checks

Status comes from the test run and the device walk, never by hand. Filled on 2 Oct 2026 from the final
review (one fresh reviewer per board named the test that proves each check) and the two full runs.
**No row is proved on a phone yet**: "walk owed" means only the founder's device walk can prove it. "Jest" = the phone suite; "Server" = the backend suite; "Walk" = seen on a real phone
(layout, keypad and video cannot be proved by Jest).

| # | Check | Proved by | Status |
|---|---|---|---|
| **A** | | | |
| 1 | New set opens with an empty name box and the grey example, from all three doors (new campaign, add another set, the pool) | Jest | pass (test) |
| 2 | Save with the box empty shows "Enter a set name." and saves nothing; a typed name is saved as typed | Jest | pass (test) |
| 3 | Editing, renaming and duplicating a set still show the stored name | Jest | pass (test) |
| **B** | | | |
| 4 | Bottom tabs show on the five main pages and on no pushed screen, in both apps | Jest (navigator options) + Walk | test part pass · walk owed |
| 4a | No blank strip above the title on any screen of either app; the title sits under the status bar on a real phone | Walk | walk owed |
| 5 | One control row: search and a Filters button reading "Filters · N" when set; "Open to invitations only" inside the sheet and still on by default in the set picker | Jest | pass (test) |
| 6 | The picker row shows name, niche · city · distance · languages and the three numbers, and no tag line; the "can't be picked" sentence is gone; the Creators tab card is unchanged | Jest | pass (test) |
| 6a | A creator who can't be invited shows "Can't invite" and the short reason for the real cause (Aim, mode, her categories, her visit cities, not taking invitations); tapping her shows the sentence | Server + Jest | pass (test) |
| 6b | A creator who has paused and one who has blocked the brand produce the same line and the same sentence; her minimums never produce a reason | Server | pass (test) |
| 7 | On a 360×760 phone about five creators are visible on arrival; with the keypad open the footer is gone | Walk | test part pass · walk owed |
| 8 | The creator app's Find brands list looks exactly as before | Walk | walk owed |
| **C** | | | |
| 9 | Shoot plan, Terms, counter screens, Content, Sale, settings and profile forms: with the keypad open the focused box, its counter and hint are visible; the main button strip is above the keypad | Walk (normal + small phone) | test part pass · walk owed |
| 10 | Send counter, Move the time, Ask for changes, sign and decline sheets: the note box is visible and the sheet's button is above the keypad | Walk | test part pass · walk owed |
| 11 | With the keypad closed each of those screens matches its locked board | Walk + before/after shots | test part pass · walk owed |
| **D** | | | |
| 12 | One line per deliverable; quantity by minus/plus between 1 and 20; "+ Add another" opens the list in place; added types cannot be chosen again; hidden at five | Jest | pass (test) |
| 13 | The duplicate and 1-to-20 refusals still exist and are asserted directly on the rule | Jest | pass (test) |
| 14 | The same control on the brand terms, brand counter sheet, creator counter, pitch form and pitch counter; what is sent to the server is unchanged | Jest + Server (unchanged suites) | pass (test) |
| **E** | | | |
| 15 | Accept / Counter / Decline: the two second-row buttons carry no top gap and identical height; Counter is absent, not disabled, when not allowed | Jest | test part pass · walk owed |
| 16 | The pairs are level on a phone: invitation, both conversations, pitch detail, pitch conversation, Send sheet, Withdraw sheet | Walk | walk owed |
| 17 | After both sign, the state button is full width with Download under it; every 20 Sep label fits on one line | Jest (labels unchanged) + Walk | test part pass · walk owed |
| 18 | Send reads "Sending" while busy; the Withdraw spinner is visible | Jest | pass (test) |
| **F** | | | |
| 19 | Set rows: "Send agreement", "Sign", "Reply", "Plan the visit", "Confirm shoot", "Review it", "Confirm live" are buttons that open the right screen; tapping the row does the same | Jest | pass (test) |
| 20 | An agreement out for signature sits under "Waiting for the creator" with a "Waiting to sign" tag, directly after "Your move"; the row and the ⋯ menu reopen it | Jest | pass (test) |
| 21 | After Send the brand is on the sent agreement with "Agreement sent." and the waiting sentence; both signature boxes read "Not signed yet" | Jest | pass (test) |
| 22 | A refused Send or Withdraw shows its reason inside the sheet | Jest | pass (test) |
| 23 | After Withdraw the creator's row is "Your move" with "Send agreement", and sending again works | Server + Jest | pass (test) |
| 24 | Creator cards read "Your move" when it is her turn; the Agreement link opens the agreement | Jest | pass (test) |
| 25 | Accepting and rejecting a pitch each show a message | Jest | pass (test) |
| 26 | Tag colours match the boards: amber for the brand's move, blue for waiting, green for active | Jest (tones) + contrast check | pass (test) |
| **G** | | | |
| 27 | Nothing is chosen or sent before a tap; a date alone sends nothing; date + time sends the right India-time moment | Jest | pass (test) |
| 28 | No day after the posting date; past times today cannot be picked; a passed posting date offers nothing | Jest | pass (test) |
| 29 | Move sheet: resets on every open; pre-filled only when the agreed time is still ahead | Jest | pass (test) |
| **H** | | | |
| 30 | A tile tap opens the viewer and never the browser, on all four content screens; the creator's Story screenshots open too | Jest | pass (test) |
| 31 | An app build without the player shows the update message and "Open in browser" for video; photos still open inside | Jest | pass (test) |
| 32 | An expired link is renewed and the video carries on; a real large video and a 10 MB photo open on both apps | Jest (renewal) + Walk | test part pass · walk owed |
| 33 | "Add a note" only on the brand's Pay for Content review; "Remove" only for the creator while editing | Jest | pass (test) |
| **J** | | | |
| 34 | A paste saves without leaving the box and the button turns on; a refusal shows the red line and keeps it off | Jest | pass (test) |
| 35 | Pressing the button with an unsaved link saves it first, then marks posted; outside-the-package links never count | Jest | pass (test) |
| 36 | Two boxes saved with answers out of order both stay filled | Jest | pass (test) |
| 37 | A caption typed just before Send is sent | Jest | pass (test) |
| **All** | | | |
| 38 | Nothing else moved: full phone suite and full backend run against the last full run — none that passed before fails now | `06-diff/` compare | pass — phone 2150 of 2150; server full run 2 Oct 16:25–16:48: 0 that passed before fail now (06-diff/backend-compare.txt) |

## Drift to be recorded at build (assertion drift against the newly locked board; none deleted)
`item4Brand` (the "Set A" value and the two navigation params) · `item5Brand` (the same-card test, the hint sentence,
"Not open to this set", the chip-driven duplicate/count walk) · backend `item5-invitations` (the brand is
never sent a reason) · `distance` (the summary chip) · `item7Brand` ("DRAFT · DRAFT",
the send fixture, the exact "Send agreement" / "Sign" texts) · `item6Brand` ("Waiting") · `shoot10`
(the day/hour pill ids; "Your move").
