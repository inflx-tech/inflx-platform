# ui-walk-fixes — spec

**Eleven screen problems the founder found walking the brand and creator apps on 1 Oct 2026.**
No new feature, no rule about money. Phone apps (brand + creator, over the air) and one small
server change (point 8). Research, one file per point: `research/C01…C11-*.md` — each point was
investigated in the code and then challenged by a second reader who re-opened every cited file.

## The founder's words (chat, 1 Oct 2026)
> "While creating set, it is automatically it is showing SET A… it should give a suggestion text
> with some name · While selecting creators… most of the things covering, influencers showing
> space… use the screen top to bottom judiciously… all filters into one button · when click on any
> text field key pad open, that typing is cover the text enter field · choosing deliverables in pay
> for content… make it clean like drop down… add symbol and quantity · [creator] sees three
> options, these buttons are not aligned with our mockups · sending agreement icon, on waiting or
> different other statuses are unable to recognise… show with button clearly · sending agreement
> from brand, buttons arranged little uneven · after sending an agreement… no status shown, means
> waiting for creator's sign · in shoot plan, selecting time is not designed properly… drop down ·
> [content] is opening in cloudflare… play without redirect · creator pasted live link… button is
> still not enabled"

## State before (verified in code 1 Oct 2026; nothing was run on a phone)
| # | Claim | Verdict | Cause |
|---|---|---|---|
| 1 | New set pre-filled "Set A" | True | `BrandSetEditScreen` seeds the box's value with the suggestion; no placeholder exists. The server never names a set. |
| 2 | Picker crowds out the list | True | ~271px of fixed top + ~147px fixed bottom on a 360×760 phone; 1–1.8 creators visible. Tab bar never hidden, 50px empty band in the header, chip row, full-size cards. |
| 3 | Keypad covers the field | True (lower-half fields) | Button bars are absolute overlays above the keypad; tab bar stays up; the shared sheet cannot shrink or scroll. 18 broken, 14 at risk, 36 safe of 68 typing places. |
| 4 | Deliverables chooser | True | `DeliverablesEditor5` draws all five type chips per row + a typed count. Board I4 draws one line per row. Shared by five screens. |
| 5 | Creator's three buttons uneven | True | The outline button carries a built-in 10 top gap and a border; the red one has neither. Decline is solid red; board draws an outline. |
| 6 | Actions/statuses unrecognisable | True | Actions and statuses share one 11px pill. "Send agreement" / "Sign" are green pills identical to "Live", and the only door. No tag at all on a sent agreement. |
| 7 | Send-agreement buttons uneven | True | Same cause as 5 on the Send, Withdraw and Download pairs. |
| 8 | No status after sending | Partly | Agreement: screen closes, toast lost, row has no tag and sits under "Waiting to answer"; the sent agreement cannot be reopened; a refused Send shows nothing. Other two-party actions already show a status. |
| 9 | Shoot time picker | True | Day strip + 14 hour chips + 4 minute chips; a phantom default that looks chosen; past hours offered. (Founder's own item 10 answer Q8 chose chips — superseded here.) |
| 10 | Content opens on Cloudflare | True | `Linking.openURL` on a 5-minute private link, photos and videos alike. The video player has been inside the app builds since 30 Sep. |
| 11 | Posted button stays off | True | Links save only when the box loses focus; a paste does not do that. The button reads the server. |

## The rules this change locks (the board: `04-preview/mockups/ui-walk-fixes-mockups-v1.html`)
| Board | Rule |
|---|---|
| A | A new set's name box opens empty with a grey example. The name stays required. Same on all three doors. |
| B | One control row: search + a Filters button. The campaign/set line lives in the title bar. Compact creator row of three lines, no tag line. The "can't be picked" sentence is gone; a creator who can't be invited says why — a short reason on her row, the full sentence when tapped. Footer hides while typing. |
| all | Bottom tabs only on the five main pages, both apps. No blank strip above any title, both apps. |
| C | The main button sits in its own strip under the form, never over it. The focused box, its counter and its error stay visible. Sheets stop below the status bar, scroll, and keep their button above the keypad. |
| D | One line per deliverable: type box, minus/number/plus, remove. The type list opens in place. "+ Add another" is a button and disappears at five. |
| E | One main button, then two equal, level choices at least 44 tall; decline is a red outline. Confirm sheets use the same pair. After both sign: the state button full width, Download under it. |
| F | A thing you tap to move the work is a labelled button naming the action; a status is a tag with an icon. Tapping the row does what its button does. After sending, the brand stays on the agreement and reads who is being waited for; a refusal is said inside the sheet; a sent or signed agreement can be reopened. |
| G | Two boxes, Date and Time, nothing pre-chosen. Calendar for the date; a list of 15-minute times for the time; past times greyed. |
| H | One tap opens a file inside the app. Photos on every phone; videos on app builds from 30 Sep, with a stated fallback on older ones. |
| J | A link saves by itself and shows saving, saved or refused. The bottom button turns on when every link box has text, and finishes the saving itself. |

## Decisions (standing autonomy unless marked FOUNDER)
| # | Decision | Why |
|---|---|---|
| U1 | One contract for all eleven points, built in slices in board order. | The same screens appear in several points (Terms, Shoot plan, Content); separate contracts would lock contradictory boards. |
| U2 | The main button stays yellow with a dark label. | That is the live app and every locked board since item 2 ("yellow is only ever the one main button"). The older "black main button" note is superseded. |
| U3 | Row action buttons are ink-outline with an arrow, never yellow. | Yellow is reserved for the one main button; black fill already means "selected". |
| U4 | Second-row buttons are at least 44 tall, not the boards' 32. | Tap size. |
| U5 | The shared buttons keep their look everywhere else; the level pair and outline decline are switched on only where drawn. | They are used on over a hundred screens. |
| U6 | Two server changes. (a) Point 8: a withdrawn agreement returns the creator to "Your move" with "Send agreement" — making Withdraw reachable without it creates a dead end. (b) Founder decision D2: the brand's creator lists carry why a creator can't be invited (which of Aim / mode / her brand categories / her visit cities), as a short line and a sentence composed on the server. | Both are small and read-only in effect: no row is stored differently. |
| U6c | A third server change, found during the build (board F): the set rows and her cards now carry `shoot.yourMove`, and the Remote stage is delivered as it really is (it stayed on "not sent" until the shoot was done — the query computed it and never sent it). Without it the phone could only guess whose turn a store visit is, and guessed wrong once she asked for another time. Read-only, no migration. | "Computed is not delivered." The row button must tell the truth. |
| U6d | A defect fixed on the way (board B, server): the "Worked with" tab inside Add creators has answered with an error on every call since item 5 shipped on 13 Sep (a malformed query no test ever asked for). It loads now and is covered by a test. | Found while adding the reason to that list. |
| U7 | Time list 7:00 am – 8:45 pm in 15-minute steps, built in the app; the Android clock stays unused. | Keeps item 10 Q8's "in-app" half; replaces its "chips" half at the founder's request. |
| U8 | Videos keep the 5-minute private link; the app renews it quietly. Nothing is cached on the phone. | Item 12 privacy rule unchanged. |
| U9 | Left out of this round: the creator app's Find brands list; pinch-zoom; PDFs in-app; recolouring every outline button in both apps; a server-side regrouping of set rows. | Scope. |
| U10 | **Anything on a live screen that a frame's caption does not say changes, stays as it is.** Frames copy the locked boards, which omit things the app has since gained (the "Use these terms for everyone" switch, character counters on Plan the visit, the counter pop-up's own title, the pitch form's two steps, plain-text hints the boards draw in grey boxes). None of those is removed or restyled by this contract. | The boards are older than the app in places; a frame is not a licence to delete. |
| U6e | Three small server corrections that follow from U6a and U6c (wave 3): the brand's Needs You number counts an agreement taken back and waiting to be re-sent; the set row offers "Withdraw agreement" exactly when a withdraw would be accepted (not for an agreement approved through the website door); and when she has asked for another visit time the brand's row says "{Name} is waiting for your answer on the store visit time." instead of "… waiting for {name} to answer". Read-only, no migration. | Each made a button or a count tell the truth about a state this contract made reachable. |
| U19 | Screens the keypad pass touched keep everything they had; three things differ at rest because every main button now uses the one shared strip: the button sits about 8 lower (the old bars had more space under them), an outline button stacked under another sits 8 below it instead of 18, and a stage with nothing to press no longer draws an empty white strip. | One strip everywhere (board C rule 1). |
| U22 | The creator's Invitation settings screen said "Your categories, cities, minimum fee and commission stay private." and "None picked means any category. Only you see this." After D2 neither is true as written (and the minimums half was already untrue: the brand's terms screen has shown them since item 5). Reworded: "Brands never see your category or city lists. A brand you've ruled out is told which rule it was, nothing more." and "None picked means any category. Brands never see your list — a brand outside it is told only that you aren't taking its category." | The app must not promise a creator more privacy than D2 leaves her. New wording, for the founder's eye at the walk. |
| U23 | When a brand has switched countering off but she may still ask for another date, the invitation's second button reads "Ask for another date" (not "Counter") and opens that request directly; the money-and-work counter is not offered. Frame E2 (Accept, then Decline alone) is what she sees once she can no longer ask for a date either. | E2 as drawn would remove the only way to ask for another date, which item 6 says the switch must never block; a button called Counter that ends in a refusal is worse. |
| U24 | A Remote agreement signed by both keeps the page it has shown since item 10 (ticks, step line, countdown) above the new stacked buttons; frame E12's "Next" card is not forced onto it. | U10: the caption is about the buttons. For the walk. |
| U25 | Creator cards: an Active card waiting on the brand says what comes next in a labelled "Next" row where the step is the brand's to start (a store visit not yet planned; a Remote parcel not yet shipped), as frame F7 draws; and a brand-new invitation card carries the "Your move" tag and an "Open" button when it is hers to answer (not when she has asked for another date and is waiting, nor on her own application). | Frame F7 and check 24; the card that most needs an answer must look like one. |
| U26 | U8 is about videos. Photos are drawn by the phone's standard picture component, which keeps a copy in the app's own private picture cache (not the gallery; other apps cannot read it) — as the small tiles have done since item 12. Turning that off needs native code, so it goes on the next app-build list. | The installed React Native has no JS switch for it. Do not tell creators photos are never stored on the brand's phone. |
| U17 | Five pitch screens (the pitch form, My pitches, one pitch on both apps, the brand's Pitches list) gained the shared title bar with a Back arrow. They had none and relied on the bottom tabs to get out; with tabs only on the five main pages (D3) there was no way back. On no board; a consequence of D3. | Found by the wave 1 reviewer. |
| U18 | The file viewer plays video with the player's own control bar: it has no sound button (the viewer adds one at the top right) and carries rewind, forward, full-screen and greyed previous/next that frame H2 does not draw; it hides after a few seconds. Changing that needs a newer player (a new app build) or a hand-built bar. | The installed player version has no switch for it. To be shown at the walk. |
| U20 | On a form longer than the screen (Plan the visit, Terms, the creator's content page), closing the keypad leaves the form where typing put it; one swipe brings the top back. Forms that fit on the screen return by themselves. Frame C2's "back in place when the keypad closes" therefore holds only for forms that fit. Making the top return by itself is a further build (remember where the form stood when the keypad opened, forget it if she drags, go back only as far as keeps the box she is in on show) that cannot be proved without a phone; it is built only if asked for at the walk. | Same as the live app before this build — nothing got worse. Moving a form by itself when the keypad closes risks pulling the box she has just tapped out from under her thumb (the form "never starts a scroll", drift C0). To be shown at the walk (checks 9 and 11). |
| U21 | On Review and send, a creator the server refuses because of one of her own invitation rules (D2) shows the short reason on her row and says the sentence when tapped; her terms are not opened, because changing them cannot get her in. Every other refused row still opens her terms. The banner above the list says "Fix them" only when something can be fixed: every refusal is her own rule → "Nothing was sent. Changing their terms won't help — remove them and send the rest."; some are and some are not → "Nothing was sent. Fix the ones you can, or remove them all and send the rest."; none is → today's "Nothing was sent. Fix them, or remove them and send the rest." The two new sentences are not in the board's approved new-words section (D6). | A consequence of D2: opening her terms would be a dead end, and "Fix them" would be untrue for her. New wording, to be shown at the walk; if it is rejected only the two sentences change (`copy5.js` `C5.review.failedBodyRemove` / `failedBodySome`) — the tap stays. Recorded until now only in `06-diff/drift/C1a.md`. |
| U11 | Set rows use the status sentences the server already sends ("Signed — plan the store visit", "{Name} says she visited — confirm the shoot is done", "Store visit agreed for …"). The row button for confirming is "Confirm shoot", matching the screen it opens. "Active" shows on a signed row only when neither side owes a step. | Keeps the fix phone-only; one name per step. |
| U12 | "Nearest first ▾" on the count line opens the Filters sheet (Sort lives there); no second menu. The time list opens at the chosen time, else at the first time still open. An open type list closes on a second tap of its box or on choosing. After "Remove" in the viewer it closes back to the row (no extra confirm, as today). | Gaps the frames leave open. |
| U13 | Line under "I've posted everything", in order of precedence: something still missing ("… to go.") › a link refused ("One link needs fixing — see above.") › saving ("Saving your link…"). The button is on only when every package box has text, every Story has its screenshot and no link is refused. | Board J leaves the order implicit. |
| U14 | On a Remote agreement the full-width "Shoot plan" button opens the Remote shoot. Today it opens nothing and shows a message written before item 11 shipped. | Adjacent fix on a button this contract restacks. |
| U15 | The brand's counter pop-up for Pay for Content labels the block "What she delivers" (today it wrongly reads "What you'll deliver", the creator's words). The fee line keeps the live "{Name} asked for". | Adjacent wording fix; live copy wins over the older board. |
| U16 | The pool door into New set keeps today's behaviour for Aim, mode, date and branch (branch is not pre-filled); only the name box changes. | Verified in `pool.service.js` / `BrandSetEditScreen`. |
| D1 | **FOUNDER, 2 Oct** — the compact creator row, with no tag line: "remove this [Pay for Sale / Pay for Content / Hybrid / +] no need to mention this". Three lines: name; niche · city · distance · languages; the three numbers. The Creators tab keeps the full card. | Supersedes his 16 Sep "same card as the Creators tab" for the pickers. |
| D2 | **FOUNDER, 2 Oct** — "remove this text [Creators whose own settings rule this set out can't be picked, and the reason is never shown to them]… when brand click on the influencer can't invite then we tell info that this creator not accepting the pay for sale or something". The row's second line is a short reason; tapping it shows the sentence. Reasons: Aim, mode, her brand categories, her store-visit cities, not taking invitations. **Unchanged:** paused and blocked read the same ("isn't taking invitations right now"); her minimums never stop an invitation. | **Reverses** item 5 PROMPT.md:259/303/541 ("Brands never receive the reason a creator failed eligibility"). What is revealed is what her public "Open to" summary already says; a block is still never revealed. |
| D3 | **FOUNDER, 2 Oct** — bottom tabs only on the five main pages, both apps ("ok for this recommendation"). | A navigation change on every pushed screen. |
| D4 | **FOUNDER, 2 Oct** — the blank strip above every title is removed, both apps ("Q3 … accepting your recommendation"). Built from the phone's real status-bar inset, so it is correct whether or not the strip was blank; the first device walk confirms it. | Touches the shared header and every tab root. |
| D5 | **FOUNDER, 2 Oct** — a link pasted without "https://" is accepted; the app adds it ("Q4 … accepting your recommendation"). | Loosens an approved item 12 rule in effect; the server rule itself is untouched. |
| D6 | **FOUNDER, 2 Oct** — "all your screens will be accepted": the board is locked with D1 and D2 applied to board B. The new words in the board's last section are approved with it. | The mockup lock. |

## Not in this change
Anything about money, escrow, wallets or checkout. The website. The shopper app. New deliverable
types. The Needs You / Home tab as a screen (its number is corrected, U6e). Clearer per-platform link refusals (server wording).

## Supersedes
Item 4 `PROMPT.md:219/370` and `02-workflow.md:11` ("suggested name Set A" as a pre-fill); item 6
board N15 (pre-typed "Set C"); item 10 Q8 (chip picker) and `06-diff/notes.md:26`; item 12 Q11
(videos in the phone's own player); item 7 board P12 (Download beside the shoot button) in favour
of item 10 V1's single state button; the creator rows of I9 / N20 / P1 / S2 in form (wording kept);
item 5 `PROMPT.md:259/303/305/541` (the brand is never told why a creator can't be invited; the
hint sentence); the 16 Sep "same card as the Creators tab" for the pickers.
