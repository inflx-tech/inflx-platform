# C09-shoot-time-picker — Shoot plan: time selection poorly designed

## TODAY
Brand app, "Plan the visit" screen, top to bottom:
1. Header "Plan the visit", then a small grey line with the creator name and set name.
2. A locked card "From the set": Mode, Branch, She goes live by.
3. Text box "Who she should ask for *", then text box "Their number *" with the hint "She sees this once you send the plan."
4. The word "Date" (no star), then one row of small day pills (e.g. THU / 1 / OCT) that scrolls sideways from today to the posting date. Today's pill is already black, as if picked.
5. The word "Time" (no star), then 14 small pills "7 am, 8 am ... 8 pm" wrapping over about three rows. "11 am" is already black.
6. A second row of four pills ":00 :15 :30 :45". ":00" is already black.
7. A bold line repeating the result, e.g. "Thu 1 Oct, 11:00 am" - shown even before the brand has touched anything.
8. Grey hint "Dates after 24 Oct aren't offered - she can't shoot after her last day to go live."
9. Text boxes "Roughly how long" and "Anything she should bring or know".
10. Fixed bottom button "Send to {first name}".

The same pill block appears on two more surfaces, in both apps:
- "Ask for another time" (creator) / "Suggest another time" (brand): a full screen with the round pill, the pill block, the old -> new line, a "Say why (optional)" box and "Send".
- "Move the visit?" (brand) / "Ask to move the visit?" (creator): a bottom sheet with the pill block, the old -> new line, a "Say why" box, a hint, then "Send new time" and "Not yet".

What goes wrong for the user:
- A time looks chosen (today, 11:00 am, with the bold summary line) but is not. Pressing Send says "Choose a date and time."
- Hours that have already gone today are still offered and look normal. The refusal "Choose a time in the future." only appears after pressing Send.
- Hour and minute are two separate groups of pills, so one time takes two taps in two places and does not read as a clock.
- Only 7 am to 8:45 pm can be chosen. Nothing earlier or later exists.
- Dates are a sideways strip, not the calendar used for every other date in the app.
- In the "Move the visit" sheet the pill block makes the sheet very tall and the sheet cannot scroll. By my arithmetic it is close to a full phone height, so it may be cut off on small phones or when the keyboard opens for the "Say why" box. I could not confirm that without running the app.

## ROOT CAUSE
The picker was deliberately built as loose chips, not as the two fields the locked board draws.

1. One component, TimePicker10 (Packages/Mobile/src/components/shoot/bits10.js:190-248), draws everything: a horizontal ScrollView of day chips (:211-223), 14 hour chips from a hard-coded list of 7 am to 8 pm (:180, :225-234), 4 minute chips (:181, :235-244) and a summary line (:245). No TextInput, no native picker, no wheel, no dropdown.

2. Phantom default (real bug). bits10.js:204 reads `const sel = istParts(value) || (days[0] ? { ...days[0], h: 11, min: 0 } : null);`. When nothing is chosen (value is null) the picker still paints today / 11 am / :00 as selected and prints the summary at :245, but never calls onChange. The parent's visitAt stays null (BrandShootPlanScreen.js:32), so review() at :61 returns "Choose a date and time." The same happens in ShootCounterScreen.js:27/:54 and sheets10.js:38/:43.

3. Past hours are not blocked. The hour chips never compare against the current time. Tapping a minute chip or today's chip after 11 am emits today 11:xx, which is already past, and the refusal only comes at Send (BrandShootPlanScreen.js:62, ShootCounterScreen.js:55, backend shootPlan.service.js:132). The founder's own item 10 answer Q8 said "Max = the posting date, min = now" (features/item10-store-visit/PROMPT.md:65). Max is enforced, min is not.

4. The departure from the board was knowingly recorded: features/item10-store-visit/06-diff/notes.md:26 says "Date and time are one picker (a day strip, hour chips, minute chips in 15-minute steps) rather than two side-by-side fields".

5. In the Move sheet the picker sits inside Sheet (components/settings/sheets.js:13-20), a plain non-scrolling View, together with a multiline note box and two buttons. The sheet's picked value is also never reset between openings (sheets10.js:38, the component stays mounted) and it does not start from the currently agreed time.

What is saved: an exact moment in ISO form (for example 2026-10-18T05:30:00.000Z), built from an Indian clock reading by istToIso (copy10.js:44-46) and sent as `visitAt`. The server only checks that it is a real moment, in the future, and on or before the end of the posting day in India (backend/src/services/shootPlan.service.js:128-136). Any new picker that still hands back that ISO moment needs no server change.

Native picker availability: @react-native-community/datetimepicker is in package.json:20 and is linked in the Android build generated on 30 Sep (PackageList.java:18-19, :91). The item 10 gap report says it was found inside the shipped APKs on 4 Aug. No file in Packages/Mobile/src imports it. The "Stage-4 guard test" that the comment at bits10.js:7-8 says forbids it no longer exists; I searched src, __tests__ and qa and found none. So a native clock is probably reachable over the air, but I cannot prove from code that every installed phone has an APK that contains it.

## MOCKUP
{
 "file": "C:\\WORK\\inflx-platform\\features\\item10-store-visit\\04-preview\\mockups\\item10-store-visit-locked.html",
 "screen_ref": "V2 Brand - the plan (line 445); V6 Creator - countering the time (line 450); V12 Either side can move it (line 458)",
 "what_mockup_shows": "Two bordered boxes side by side on one row. Left: label 'Date *' (V12: 'New date *') with a small calendar icon and a value like '18 Oct'. Right: label 'Time *' with a small clock icon and a value like '11:00 am'. Under the row on V2 is the hint about dates after the posting date. V6 and V12 show the same row at the top of a bottom sheet, then the old -> new line, 'Say why (optional)', a grey note and one main button ('Send' / 'Send new time'). The board does not draw what opens when a box is tapped.",
 "live_matches_mockup": "no",
 "difference": "Live replaces the two boxes with a day-chip strip, 14 hour chips, 4 minute chips and a summary line. The labels have no required star, V12's 'New date' label is unused (the copy exists at copy10.js:215 but the picker prints 'Date'), and V6 is a full screen rather than a sheet. The departure is recorded in 06-diff/notes.md:26. The hint wording also changed on 1 Oct with the posting-date rule ('her last day to go live' instead of 'the day she posts'); that change is intentional."
}

## CORRECTIONS
- Every file:line citation checked out; nothing is stale. Confirmed: bits10.js:180-181, :190-248, :204, :245; BrandShootPlanScreen.js:32, :61-62, :106-108; ShootCounterScreen.js:27, :54-56, :80; sheets10.js:37-61; settings/sheets.js:13-20, :119-120; copy10.js:13-16, :28-46, :215; shootPlan.service.js:128-136; DateField.js:42-187; mockup lines 445/450/458; 06-diff/notes.md:26, :42-43; PROMPT.md:65; PackageList.java:18-19, :91 (file dated 2026-09-30 08:19); ITEM10_STOREVISIT_GAP_REPORT.md:511-523; shoot10.test.js:78-98; package.json:20; theme/tokens.js:512.
- Framing error: the chip wall is not only a builder's departure from the board. The founder's own recorded answer was 'Q8 — The JS chip picker, restyled, 15-minute steps' (features/item10-store-visit/PROMPT.md:65; lock.json:13 'Q8 the JS chip picker, keep the Stage-4 guard'). The investigator's open question 3 presents Q8 as only 'in-app vs Android clock'. Option A keeps the 'pure JS' half of Q8 but replaces the 'chip' half, so it supersedes a recorded founder decision and must be recorded as such.
- A contract document misstates the departure and the investigator did not flag it: features/item10-store-visit/04-preview/workflow-prediction.md:24-25 says 'Deliberate departures: none from the mockups ... which the mockups do not show either way'. The mockup does show two fields (line 445 `.twocol` with 'Date *' and 'Time *').
- 06-diff/notes.md is muddled on sheets and the investigator only half-corrected it. The locked board draws BOTH V6 (line 450) and V12 (line 458) as bottom sheets over a dimmed screen. Live V6 is a full screen (ShootCounterScreen) and live V12 is a sheet. notes.md:30 lists V6 departures as 'none' (wrong) and notes.md:36 says V12 is 'a sheet ... rather than a full screen' (wrong: the board draws a sheet). The investigator's screen_to_draw never says whether V6 should be drawn as a sheet or kept as a full screen.
- Recommended behaviour 'Move sheet opens already showing the currently agreed time' is unsafe as stated. BrandShootScreen.js opens the same sheet from three doors: :206 'Send a new time' (shown only when sh.passed, i.e. the agreed time is already past), :214 'Move the visit', and :219 'She didn't come — send a new time' (stage attended, visit time normally past). In two of the three the pre-filled value would be a past time: a greyed calendar day shown as chosen, and Send answering 'Choose a different time before you send this.' (sheets10.js:44) or the server's 'Choose a time in the future.'
- Option A risk (1) is overstated. A DateField calendar (its own Modal) inside a Sheet (another Modal) is already live: components/campaigns/sheets4.js:87-90 (Duplicate set sheet), and also CreatorOfferSheet.js:149-150 and OfferBuilderSheet.js:381-382. The stacked-sheet pattern has precedent; only the new time list on top of the Move sheet is untested.
- The server rule lives in two places, not one. The investigator cited only shootPlan.service.js:128-136 (used at :253). The negotiation engine has its own copy at backend/src/services/negotiation.service.js:260-269 (normalizeShootSnapshot, called at :243) with the identical three checks. Conclusion unchanged (any ISO instant is accepted, no server change), but both sites exist.
- The Move sheet has no client-side past-time check at all (sheets10.js:42-47 checks only 'required' and 'nothing changed'); a past time there is refused only by the server and shown via serverError. The investigator's list of client refusals (BrandShootPlanScreen.js:62, ShootCounterScreen.js:55) is right but did not note the sheet lacks one.
- 'Close to a full phone height' for the Move sheet is unverified arithmetic. My own estimate is roughly 690 dp of content (title, day strip, three rows of hour pills, minute row, summary, change line, multiline note, hint, two buttons, padding), about 85-95% of a typical 740-800 dp phone. Neither of us ran it. The more certain problem is that Sheet (settings/sheets.js:13-20) has no scroll and no keyboard handling, and none of the shoot files use KeyboardAvoidingView, so the 'Say why' box sits low in a tall sheet inside a Modal. That is the founder's separate keyboard complaint on this surface.
- The stale-guard claim is right and slightly understated: no test anywhere in Packages/Mobile (outside node_modules) or qa/ references the native picker, yet three documents say the guard exists: bits10.js:7-8, 06-diff/notes.md:42-43 ('is kept and now enforces Q8') and 02-workflow.md:33-34 ('stays'). If the founder wants the Android clock to stay banned, nothing currently enforces it.

## MISSED SITES
- C:\WORK\inflx-platform\Packages\Mobile\src\screens\brand\BrandShootScreen.js :: Lines 206, 214 and 219: three separate buttons open the same Move sheet. :206 (time passed, 'Send a new time') and :219 ('She didn't come — send a new time') open it when the agreed time is already past. The investigator cited only :224 and did not account for these when recommending a pre-fill.
- C:\WORK\inflx-platform\backend\src\services\negotiation.service.js :: Lines 260-269 (normalizeShootSnapshot, called at :243): second copy of the visit-time rule, used when the time goes through the negotiation engine. Same checks as shootPlan.service.js:128-136; no change needed, but it is a second place the rule lives.
- C:\WORK\inflx-platform\Packages\Mobile\src\components\campaigns\sheets4.js :: Lines 87-90: DateField already used inside Sheet (a calendar sheet stacked on a sheet) in the live Duplicate-set flow. Precedent for the Move sheet's Date box; lowers the stacked-sheet risk.
- C:\WORK\inflx-platform\features\item10-store-visit\04-preview\workflow-prediction.md :: Lines 24-25 wrongly record 'Deliberate departures: none from the mockups'. Needs correcting when this fix is recorded.
- C:\WORK\inflx-platform\features\item10-store-visit\lock.json :: Line 13 records Q8 as 'the JS chip picker, keep the Stage-4 guard'. The fix replaces the chips, so the decision must be recorded as superseded; the guard it mentions does not exist.
- C:\WORK\inflx-platform\features\item10-store-visit\02-workflow.md :: Lines 33-34 say the Stage-4 guard test 'stays'. No such test exists in the repo. Same stale claim as bits10.js:7-8 and notes.md:42-43.
- C:\WORK\inflx-platform\Packages\Mobile\src\components\settings\sheets.js :: Sheet (:13-20) is the shared bottom sheet for PickerSheet, ConfirmSheet, ActionSheet and many feature sheets across both apps. It has no keyboard avoidance and no scroll. Any 'make the Move sheet scroll or avoid the keyboard' fix made inside Sheet changes every sheet in both apps; do it inside MoveTimeSheet10 or behind an opt-in prop.
- C:\WORK\inflx-platform\Packages\Mobile\src\components\shoot\bits10.js :: Imported by 15 files across items 10-15 (BrandAgreementScreen, BrandShootScreen, ShootScreen, BrandContentScreen, ContentScreen, BrandSaleLiveScreen, SaleLiveScreen, BrandRemoteScreen, RemoteShootScreen, bits12, sheets12, sheets11, plus the three picker callers). The exported stylesheet `g` shares `chip`/`chipText` with DelayedChip10. A bad import or a deleted shared style here breaks every one of those screens, not just the picker.

## FIX RISKS
- Pre-filling the Move sheet with the agreed time breaks two of its three brand entry points (BrandShootScreen.js:206 and :219), where the agreed time is already past. Pre-fill only when currentAt is still in the future; otherwise open empty.
- TimePicker10's contract is one ISO instant in and out. Two independent boxes create a half-chosen state (date without time, or time without date) that cannot be expressed as an instant. The picker must hold the half privately and emit only when both are set. That private half must also reset when the parent sets value back to null, and MoveTimeSheet10 stays mounted between openings (sheets10.js:38), so without an explicit reset the stale half reappears.
- Changing the date after choosing a time can make the pair a past moment (time 10:00 am chosen, then date switched to today at 3 pm). The picker needs a rule: clear the time, or show it in red. The drawn screens must show which.
- Edge states the current picker handles and the new one must keep: (a) posting date already passed, where today the picker shows 'No day works — the posting date has passed.' and shoot10.test.js:94-97 asserts zero day cells; (b) today after 8:45 pm India time, when every slot today is gone, so today must be greyed in the calendar or the time list is entirely grey; (c) posting date is today and it is late, so nothing can be chosen at all.
- DateField cannot be dropped in unchanged. It prints 'D Mon YYYY' via prettyDate (:35-40, :127) where the board shows '18 Oct'; it has a trailing caret and no leading icon (:133-134); it carries its own 10px bottom margin (:130); and its minimum day defaults to the phone's own 'today' (:59-62) rather than India's. Six other screens in both apps use it (BrandSetEditScreen:171, MoveRequestScreen:87, PitchFormScreen:189, sheets4:90, CreatorOfferSheet:149-150, OfferBuilderSheet:381-382) and dateField.test.js asserts on its default 'date-field' id and 'day-YYYY-MM-DD' cells. Changes must be additive optional props (leading icon, short format), or the picker should draw its own box.
- Test ids change shape. Today the day pills are 'day-18' and the test counts them with /^day-\d+$/ (shoot10.test.js:85) and presses 'hour-16' (:87). DateField cells are 'day-2026-10-18' and hour/minute pills disappear. shoot10.test.js:78-98 must be rewritten to assert the new behaviour, not deleted or loosened (no-fake-green rule). No Maestro flow or qa script references these ids (checked), so nothing else breaks.
- bits10.js is a shared file for 15 screens. Put the new time list in its own file and keep the TimePicker10 export name and props. Do not delete `g.chip` / `g.chipText` (used by DelayedChip10) when removing the pill styles. importsResolve.test.js and hooksBeforeReturns.test.js both run over new files.
- Every accessibilityState value on greyed calendar days and greyed time rows must be an explicit boolean. accessibilityStateBooleans.test.js enforces it on source and this exact mistake has already crashed the app once (DateField.js:88-103).
- Both apps must be published over the air, one at a time: brand (Plan the visit, Suggest another time, Move the visit) and influencer (Ask for another time, Ask to move the visit). Pure JS, native runtime stays '3', no server change, no migration. The follower app is unaffected.
- Governance: this is a UI-governed and Mobile-governed change that redraws a locked board and supersedes a recorded founder answer (Q8). It needs a contract entry with the new mockups locked and a 06-diff note before push; gov-check blocks otherwise. The stale 'Stage-4 guard' sentences (bits10.js:7-8, notes.md:42-43, 02-workflow.md:33-34) should be corrected in the same change, or the guard actually written if the founder still wants the Android clock banned.
- If the Move sheet's keyboard problem is fixed by editing the shared Sheet component, every bottom sheet in both apps changes behaviour. Keep that fix local to MoveTimeSheet10 or opt-in.
- The 7:00 am to 8:45 pm range is a client-only limit; the server accepts any future time up to the end of the posting day (both validation sites). Widening or keeping the range is a product choice with no server impact, but a time list of all 96 quarter-hours would be long. Decide the range before drawing.

## FIX FINAL
Option A stands, with corrections. Build the two boxes the locked board draws, entirely in JavaScript, shipped over the air to the brand and creator apps. No server change, no migration, no new app install. Do not use the Android clock.

1. **Keep the caller contract.** Keep the `TimePicker10` name and props (`value`, `onChange`, `maxDay`, `minDay`, `testID`) and the ISO-instant output, so the three callers (BrandShootPlanScreen.js:106, ShootCounterScreen.js:80, sheets10.js:51) and both server checks stay untouched. Add one optional prop for the date label so the Move sheet can say "New date" (copy already at copy10.js:215).

2. **New time list in its own file** (for example components/TimeField.js), not inside bits10.js, which 15 screens import. Do not remove `g.chip` / `g.chipText`.

3. **Date box.** Reuse DateField's calendar only through additive optional props (leading calendar icon, short "18 Oct" format, no bottom margin). Always pass minDate = today in India (`todayIst10()`) and maxDate = posting date. Leave the six existing DateField callers and dateField.test.js untouched.

4. **Time box.** Opens a bottom-sheet list of whole times in 15-minute steps. One tap picks and closes. The current pick is ticked. When the chosen date is today, times already gone are greyed and cannot be tapped. Every accessibilityState value is an explicit boolean.

5. **No pretend default.** Both boxes read "Choose a date" / "Choose a time" until tapped. The picker holds a half-finished choice privately and calls onChange only when both are set. It resets that half when the parent sets value to null.

6. **Date changed after time.** If the new pair is a past moment, clear the time and show the placeholder again.

7. **Edge states.** Keep "No day works — the posting date has passed." Grey out today once the last slot today has gone.

8. **Move sheet.** Reset on every open. Pre-fill with the agreed time ONLY when that time is still in the future; open empty when it has passed (the "Send a new time" and "She didn't come" doors). Add a client-side "Choose a time in the future." check to match the other two surfaces. Handle the "Say why" keyboard inside MoveTimeSheet10, not in the shared Sheet.

9. **Counter screen (V6).** Keep it as the full screen it is today rather than converting it to the sheet the board draws. A full scrolling screen copes with the keyboard; a sheet does not. Record that as the one deliberate departure.

10. **Tests.** Rewrite shoot10.test.js:78-98 to assert: nothing chosen or emitted before a tap; a date alone emits nothing; date plus time emits the right India-time instant; no day after the posting date; past times today cannot be picked; a passed posting date offers nothing. Add a Move-sheet test for reset and for the pre-fill rule.

11. **Record it.** Q8's "chip" half is superseded by the founder's new request and its "no Android clock" half is kept. Correct workflow-prediction.md:24-25 and the three stale "Stage-4 guard" sentences. Lock the new mockups before any app code, then publish brand and influencer OTAs one at a time after an explicit go.

Questions the founder must settle before drawing:
- One list of 15-minute times, or hour then minute?
- Keep 7:00 am to 8:45 pm, or widen it?
- Main button yellow, as the item 10 board and live app have it, or the black rule?

## DRAW FINAL
Draw on the item 10 look. Change ONLY the date/time control and what opens from it. All other fields, wording and buttons stay as the locked board (V2, V6, V12), with today's live wording where it has since changed ("She goes live by", "her last day to go live").

**A. Brand "Plan the visit" (full screen, V2) — five frames**
1. **Empty.** Header "Plan the visit"; grey line "TANVI SURESH · SET A"; locked card "From the set" (Mode, Branch, She goes live by); "Who she should ask for *"; "Their number *" with hint "She sees this once you send the plan." Then one two-column row:
   - left box, label "Date *", calendar icon, grey "Choose a date";
   - right box, label "Time *", clock icon, grey "Choose a time".
   No pills, no summary line, nothing pre-chosen. Hint under the row: "Dates after 24 Oct aren't offered — she can't shoot after her last day to go live." Then "Roughly how long", "Anything she should bring or know". Fixed bottom button "Send to Tanvi" with the send icon.
2. **Date box tapped.** Bottom sheet with the app's existing month calendar: month title with arrows, Monday-first grid, days before today and after 24 Oct greyed, chosen day a black square with a white number, "Cancel" underneath. One tap picks and closes.
3. **Time box tapped.** Bottom sheet titled "Time": a single scrolling column of whole times in 15-minute steps ("7:00 am", "7:15 am" ...). The chosen row is bold with a tick on the right. Show the today variant: times already gone are grey and cannot be tapped.
4. **Filled.** Boxes read "18 Oct" and "11:00 am", exactly as locked V2.
5. **Error.** Both boxes outlined red, red line under the row: "Choose a date and time." Second variant: "Choose a time in the future."
Also one small frame: date changed to today after a time that has now passed. The Time box returns to grey "Choose a time".

**B. "Ask for another time" (creator) / "Suggest another time" (brand) (V6)**
Draw as the full screen it is today, not a sheet, and mark that as the one agreed departure. Round pill "ROUND 1 OF 2"; the same two boxes ("Date *", "Time *"), empty; the line "They asked for 18 Oct, 11:00 am → —", which becomes "→ 19 Oct, 4:00 pm" once both are chosen; "Say why (optional)"; grey note "Only the time can change. The branch and the 24 Oct posting date came from the set."; bottom button "Send". Draw the creator title and the brand title.

**C. Bottom sheet "Move the visit?" (brand) / "Ask to move the visit?" (creator) (V12) — three frames**
1. **Agreed time still ahead.** Boxes "New date *" and "Time *", opening already showing the agreed "19 Oct" / "4:00 pm". Line "Agreed 19 Oct, 4:00 pm → —" until something changes. "Say why (optional)". Hint "Tanvi has to agree the new time. It still has to be before 24 Oct." Buttons "Send new time" and "Not yet". Show the sheet at its new, much shorter height.
2. **Agreed time already past** (opened from "Send a new time" or "She didn't come — send a new time"). Same sheet with both boxes EMPTY ("Choose a date" / "Choose a time").
3. **Keyboard up on "Say why".** The box and the "Send new time" button stay visible above the keyboard.

**D. Two edge frames**
- Posting date already passed: in place of the boxes, the red line "No day works — the posting date has passed."
- Late evening today: today greyed in the calendar, first choosable day is tomorrow.

**Colour.** Chosen day and ticked time are black with white. Draw the main button as the item 10 board and the live app have it (yellow, black label) unless the founder says the black-button rule applies here.

## QUESTIONS
- For the time dropdown, is a simple scrolling list of 15-minute times (7:00 am, 7:15 am ...) what you mean by 'drop down', or do you want two smaller lists (hour, then minutes)?
- Today only 7:00 am to 8:45 pm can be chosen. Keep that range, or widen it (for example 6 am to 10 pm) for evening store shoots?
- Your item 10 decision Q8 chose the in-app picker over the phone's own Android clock. I recommend keeping that and building the dropdown in-app. OK?
- Main button colour: the locked item 10 board and the live app draw the main button yellow with black text (theme/tokens.js:512, mockup .b-pri). The brief for this round says main buttons are black with white text. Which should the redrawn screens use?
- In the 'Move the visit' sheet, should the boxes open already showing the currently agreed date and time (my recommendation), or empty?
- Today a brand can still be offered hours that have already passed and is only refused at Send. I plan to grey those out, with no minimum notice (your Q10: 'this afternoon' is fine). Confirm?

## TESTS
- Packages/Mobile/src/components/shoot/__tests__/shoot10.test.js
- Packages/Mobile/src/components/__tests__/dateField.test.js
- Packages/Mobile/src/__tests__/accessibilityStateBooleans.test.js
